import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Dai, USDT, Pool, Dai__factory, USDT__factory, Pool__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseUnits } from 'ethers/lib/utils';

async function main() {
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

  console.log('Dai Address:', dai.address);
  console.log('USDT Address:', usdt.address);
  console.log('Pool Address:', pool.address);
  console.log('Owner Address:', owner.address);
  console.log('LP0 Address:', lp0.address);
  console.log('LP1 Address:', lp1.address);
  console.log('USER0 Address:', user0.address);
  console.log('USER1 Address:', user1.address);

  // await dai.connect(lp0).approve(pool.address, v1000);
  // await usdt.connect(lp0).approve(pool.address, v250);
  // await pool.connect(lp0).addLiquidity(v1000, v250); // Rate's set as 4:1

  // await dai.connect(user0).approve(pool.address, v1000);
  // await pool.connect(user0).swap(v1000, 0);

  // console.log(`Expected Dai Balance is ${v10000.sub(v1000)}`, await dai.balanceOf(user0.address));
  // console.log(`Expected USDT Balance is ${v10000.add(v125)}`, await usdt.balanceOf(user0.address));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
