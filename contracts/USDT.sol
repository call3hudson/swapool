// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDT is Ownable, ERC20 {
    constructor() ERC20("USDT token", "USD") {

    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}