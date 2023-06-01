// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Dai is Ownable, ERC20 {
    constructor() ERC20("Dai Token", "DAI") {

    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}