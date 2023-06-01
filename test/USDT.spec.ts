import { expect } from 'chai';
import { ethers } from 'hardhat';
import { USDT, USDT__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('USDT', function () {
  let usdt: USDT;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const USDT: USDT__factory = (await ethers.getContractFactory('USDT', owner)) as USDT__factory;
    usdt = await USDT.connect(owner).deploy();
    await usdt.deployed();
  });

  describe('#mint', async () => {
    it('Should prevent if non-owner tries to mint', async () => {
      // Check the owner
      await expect(usdt.connect(user).mint(user.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });
});
