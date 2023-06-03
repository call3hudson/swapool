import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Dai, Dai__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Dai', function () {
  let dai: Dai;

  // good you've done a good job...
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const Dai: Dai__factory = (await ethers.getContractFactory('Dai', owner)) as Dai__factory;
    dai = await Dai.connect(owner).deploy('Test Dai', 'TDA');
    await dai.deployed();
  });

  describe('#mint', async () => {
    it('Should prevent if non-owner tries to mint', async () => {
      // Check the owner
      await expect(dai.connect(user).mint(user.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });
});
