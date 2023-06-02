import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Dai, Pool, Dai__factory, Pool__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseUnits } from 'ethers/lib/utils';

describe('Pool', function () {
  let pool: Pool;
  let dai0: Dai;
  let dai1: Dai;

  let owner: SignerWithAddress;
  let lp0: SignerWithAddress;
  let lp1: SignerWithAddress;
  let user0: SignerWithAddress;
  let user1: SignerWithAddress;

  const v100000 = parseUnits('100000', 18);
  const v10000 = parseUnits('10000', 18);
  const v1000 = parseUnits('1000', 18);
  const v500 = parseUnits('500', 18);
  const v100 = parseUnits('100', 18);
  const v250 = parseUnits('250', 18);
  const v125 = parseUnits('125', 18);

  beforeEach(async () => {
    [owner, lp0, lp1, user0, user1] = await ethers.getSigners();

    const Dai: Dai__factory = (await ethers.getContractFactory('Dai', owner)) as Dai__factory;
    dai0 = await Dai.connect(owner).deploy('Dai0', 'DA0');
    await dai0.deployed();
    await dai0.connect(owner).mint(lp0.address, v10000);
    await dai0.connect(owner).mint(lp1.address, v10000);
    await dai0.connect(owner).mint(user0.address, v10000);
    await dai0.connect(owner).mint(user1.address, v10000);

    dai1 = await Dai.connect(owner).deploy('Dai1', 'DA1');
    await dai1.deployed();
    await dai1.connect(owner).mint(lp0.address, v10000);
    await dai1.connect(owner).mint(lp1.address, v10000);
    await dai1.connect(owner).mint(user0.address, v10000);
    await dai1.connect(owner).mint(user1.address, v10000);

    const Pool: Pool__factory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory;
    pool = await Pool.connect(owner).deploy(dai0.address, dai1.address);
    await pool.deployed();
  });

  describe('constructor', () => {
    it('Should check the pair token', async () => {
      // Check the pair token
      const token0_address = await pool.token0();
      const token1_address = await pool.token1();
      expect(token0_address).to.equal(dai0.address);
      expect(token1_address).to.equal(dai1.address);
    });
  });

  describe('#addLiquidity', () => {
    it('Should revert if no token was provided', async () => {
      await expect(pool.connect(lp0).addLiquidity(0, 0, 0, 0)).to.revertedWith(
        'Invalid amount : You must provide pair tokens'
      );
    });

    it('Should revert if it exceeds the desired amount', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await expect(pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250))
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp0.address, v500.sub(1000), v1000, v250); // Rate's set as 4:1

      await dai0.connect(lp1).approve(pool.address, v500);
      await dai1.connect(lp1).approve(pool.address, v250);
      await expect(pool.connect(lp1).addLiquidity(v500, v250, v500, v250)) // In this case, they will be rewarded according to the amount of v500
        .to.revertedWith('Reverted : Minimum desired amount exceeds');
    });

    it('Single provide', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await expect(pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250))
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp0.address, v500.sub(1000), v1000, v250); // Rate's set as 4:1
    });

    it('Multiple provide', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await expect(pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250))
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp0.address, v500.sub(1000), v1000, v250);

      await dai0.connect(lp1).approve(pool.address, v500);
      await dai1.connect(lp1).approve(pool.address, v125);
      await expect(pool.connect(lp1).addLiquidity(v500, v125, v500, v125)) // In this case, they will be rewarded according to the amount of v500
        .to.emit(pool, 'LiquidityProvided')
        .withArgs(lp1.address, v250, v500, v125);
    });
  });

  describe('#removeLiquidity', () => {
    it('Should revert if invalid input was provided', async () => {
      await expect(pool.connect(lp0).removeLiquidity(0, 0, 0)).to.revertedWith(
        'Invalid amount : You must provide valid amount'
      );
    });

    it('Should revert if token is insufficient', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250);

      await expect(pool.connect(lp0).removeLiquidity(v500, v1000, v250)).to.revertedWith(
        'Invalid amount : Insufficient LP token'
      );
    });

    it('Should revert if it exceeds the desired amount', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250);

      await expect(pool.connect(lp0).removeLiquidity(v250, v1000, v250)).to.revertedWith(
        'Reverted : Minimum desired amount exceeds'
      );
    });

    it('Simple refund', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250); // Rate's set as 4:1

      await expect(pool.connect(lp0).removeLiquidity(v250, v500, v125))
        .to.emit(pool, 'LiquidityRefunded')
        .withArgs(lp0.address, v250, v500, v125); // Rate's set as 4:1

      expect(await dai0.balanceOf(lp0.address)).to.equal(v10000.sub(v500));
      expect(await dai1.balanceOf(lp0.address)).to.equal(v10000.sub(v125));
    });

    it('Complex refund', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250); // Rate's set as 4:1

      // Do some swapping

      await dai0.connect(user0).approve(pool.address, v1000);
      await pool.connect(user0).swap(v1000, dai0.address, 0);

      await expect(pool.connect(lp0).removeLiquidity(v250, v1000, v125.div(2)))
        .to.emit(pool, 'LiquidityRefunded')
        .withArgs(lp0.address, v250, v1000, v125.div(2));

      expect(await dai0.balanceOf(lp0.address)).to.equal(v10000);
      expect(await dai1.balanceOf(lp0.address)).to.equal(v10000.sub(v125.mul(3).div(2)));
    });
  });

  describe('#swap', () => {
    it('Should revert if invalid input was provided', async () => {
      await expect(pool.connect(user0).swap(0, dai0.address, 0)).to.revertedWith(
        'Invalid amount : You must provide integer amount'
      );
      await expect(pool.connect(user0).swap(v1000, user0.address, v1000)).to.revertedWith(
        'Invalid token addr : You must input valid address'
      );
    });

    it('Should revert if minimum desired amount exceeds', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250); // Rate's set as 4:1

      await expect(pool.connect(user0).swap(v1000, dai0.address, v250)).to.revertedWith(
        'Reverted : Minimum desired amount exceeds'
      );
    });

    it('Simple swap', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250); // Rate's set as 4:1

      await dai0.connect(user0).approve(pool.address, v1000);
      expect(await pool.connect(user0).swap(v1000, dai0.address, v125))
        .to.emit(pool, 'Swapped')
        .withArgs(user0.address, v1000, v125);

      expect(await dai0.balanceOf(user0.address)).to.equal(v10000.sub(v1000));
      expect(await dai1.balanceOf(user0.address)).to.equal(v10000.add(v125));
    });

    it('Double swap', async () => {
      await dai0.connect(lp0).approve(pool.address, v1000);
      await dai1.connect(lp0).approve(pool.address, v250);
      await pool.connect(lp0).addLiquidity(v1000, v250, v1000, v250); // Rate's set as 4:1

      await dai0.connect(user0).approve(pool.address, v1000);
      expect(await pool.connect(user0).swap(v1000, dai0.address, v125))
        .to.emit(pool, 'Swapped')
        .withArgs(user0.address, v1000, v125);

      expect(await dai0.balanceOf(user0.address)).to.equal(v10000.sub(v1000));
      expect(await dai1.balanceOf(user0.address)).to.equal(v10000.add(v125));

      // Another LP
      await dai0.connect(lp1).approve(pool.address, v1000.mul(3));
      await dai1.connect(lp1).approve(pool.address, v125);
      await pool.connect(lp1).addLiquidity(v1000.mul(3), v125, v1000.mul(2), v125);

      await dai1.connect(user1).approve(pool.address, v1000);
      expect(await pool.connect(user1).swap(v1000, dai1.address, v1000.mul(3).add(v100.mul(2))))
        .to.emit(pool, 'Swapped')
        .withArgs(user1.address, v1000, v1000.mul(3).add(v500.add(v100)));

      expect(await dai0.balanceOf(user1.address)).to.equal(
        v10000.add(v1000.mul(3).add(v100.mul(2)))
      );
      expect(await dai1.balanceOf(user1.address)).to.equal(v10000.sub(v1000));
    });
  });
});
