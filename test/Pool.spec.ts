import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Dai, USDT, Pool, Dai__factory, USDT__factory, Pool__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseUnits } from 'ethers/lib/utils';

describe('Pool', function () {
  let pool: Pool;
  let dai: Dai;
  let usdt: USDT;

  let owner: SignerWithAddress;
  let lp0: SignerWithAddress;
  let lp1: SignerWithAddress;
  let user0: SignerWithAddress;
  let user1: SignerWithAddress;

  const v100000 = parseUnits('100000', 18);
  const v10000 = parseUnits('10000', 18);
  const v1000 = parseUnits('1000', 18);
  const v500 = parseUnits('500', 18);
  const v250 = parseUnits('250', 18);
  const v125 = parseUnits('125', 18);
  const v50 = parseUnits('10', 18);

  beforeEach(async () => {
    [owner, lp0, lp1, user0, user1] = await ethers.getSigners();

    const Dai: Dai__factory = (await ethers.getContractFactory('Dai', owner)) as Dai__factory;
    dai = await Dai.connect(owner).deploy();
    await dai.deployed();
    await dai.connect(owner).mint(lp0.address, v10000);
    await dai.connect(owner).mint(lp1.address, v10000);
    await dai.connect(owner).mint(user0.address, v10000);
    await dai.connect(owner).mint(user1.address, v10000);

    const USDT: USDT__factory = (await ethers.getContractFactory('USDT', owner)) as USDT__factory;
    usdt = await USDT.connect(owner).deploy();
    await usdt.deployed();
    await usdt.connect(owner).mint(lp0.address, v10000);
    await usdt.connect(owner).mint(lp1.address, v10000);
    await usdt.connect(owner).mint(user0.address, v10000);
    await usdt.connect(owner).mint(user1.address, v10000);

    const Pool: Pool__factory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory;
    pool = await Pool.connect(owner).deploy(dai.address, usdt.address);
    await pool.deployed();
  });

  describe('constructor', () => {
    it('Should check the pair token', async () => {
      // Check the pair token
      const token0_address = await pool.token0();
      const token1_address = await pool.token1();
      expect(token0_address).to.equal(dai.address);
      expect(token1_address).to.equal(usdt.address);
    });
  });

  describe('#addLiquidity', () => {
    it('Should revert if no token was provided', async () => {
      await expect(pool.connect(lp0).addLiquidity(0, 0)).to.revertedWith(
        'Invalid amount : You must provide pair tokens'
      );
    });

    it('Single provide', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await expect(pool.connect(lp0).addLiquidity(v1000, v250))
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp0.address, v500.sub(1000), v1000, v250); // Rate's set as 4:1
    });

    it('Multiple provide', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await expect(pool.connect(lp0).addLiquidity(v1000, v250))
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp0.address, v500.sub(1000), v1000, v250);

      await dai.connect(lp1).approve(pool.address, v500);
      await usdt.connect(lp1).approve(pool.address, v250);
      await expect(pool.connect(lp1).addLiquidity(v500, v250)) // In this case, they will be rewarded according to the amount of v500
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp1.address, v250, v500, v250);
    });
  });

  describe('#removeLiquidity', () => {
    it('Should revert if invalid input was provided', async () => {
      await expect(pool.connect(lp0).removeLiquidity(0)).to.revertedWith(
        'Invalid amount : You must provide valid amount'
      );
    });

    it('Should revert if it is not LP', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250);

      await expect(pool.connect(lp0).removeLiquidity(v500)).to.revertedWith(
        'Invalid amount : Insufficient LP token'
      );
    });

    it('Simple refund', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250); // Rate's set as 4:1

      await expect(pool.connect(lp0).removeLiquidity(v250))
        .to.emit(pool, 'LiquidityRefunded')
        .withArgs(lp0.address, v250, v500, v125); // Rate's set as 4:1

      expect(await dai.balanceOf(lp0.address)).to.equal(v10000.sub(v500));
      expect(await usdt.balanceOf(lp0.address)).to.equal(v10000.sub(v125));
    });

    it('Complex refund', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250); // Rate's set as 4:1

      // Do some swapping

      await dai.connect(user0).approve(pool.address, v1000);
      await pool.connect(user0).swap(v1000, 0);

      await expect(pool.connect(lp0).removeLiquidity(v250))
        .to.emit(pool, 'LiquidityRefunded')
        .withArgs(lp0.address, v250, v1000, v125.div(2));

      expect(await dai.balanceOf(lp0.address)).to.equal(v10000);
      expect(await usdt.balanceOf(lp0.address)).to.equal(v10000.sub(v125.mul(3).div(2)));
    });
  });

  describe('#swap', () => {
    it('Should revert if invalid input was provided', async () => {
      await expect(pool.connect(user0).swap(0, 0)).to.revertedWith(
        'Invalid amount : You must provide at least one token'
      );
    });

    it('Should revert if user balance is insufficient', async () => {
      await expect(pool.connect(user0).swap(v100000, 0)).to.revertedWith(
        'Invalid amount : Insufficient token'
      );
      await expect(pool.connect(user0).swap(0, v100000)).to.revertedWith(
        'Invalid amount : Insufficient token'
      );
    });

    it('Sample swap from token0 to token1', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250); // Rate's set as 4:1

      await dai.connect(user0).approve(pool.address, v1000);
      await pool.connect(user0).swap(v1000, 0);

      expect(await dai.balanceOf(user0.address)).to.equal(v10000.sub(v1000));
      expect(await usdt.balanceOf(user0.address)).to.equal(v10000.add(v125));
    });

    it('Sample swap from token1 to token0', async () => {
      await dai.connect(lp0).approve(pool.address, v1000);
      await usdt.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250); // Rate's set as 4:1

      await usdt.connect(user0).approve(pool.address, v250);
      await pool.connect(user0).swap(0, v250);

      expect(await dai.balanceOf(user0.address)).to.equal(v10000.add(v500));
      expect(await usdt.balanceOf(user0.address)).to.equal(v10000.sub(v250));
    });
  });
});
