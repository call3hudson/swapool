// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Dai is Ownable, ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {

    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}