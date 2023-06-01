// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Pool is ERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    uint256 public constant MINIMUM_LIQUIDITY = 1e3;
    
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public k;
    
    event LiquidityProvided(address indexed sender, uint liquidity, uint amount0, uint amount1);
    event LiquidityRefunded(address indexed sender, uint liquidity, uint amount0, uint amount1);
    event Swapped(address indexed sender, uint amount0, uint amount1, uint amountSwapped1, uint amountSwapped0);
    
    constructor(IERC20 token0_, IERC20 token1_) ERC20("LP Token", "LPT") {
        token0 = token0_;
        token1 = token1_;
    }

    function addLiquidity(uint256 tokenAmount0_, uint256 tokenAmount1_) external {
        require(tokenAmount0_ > 0 && tokenAmount1_ > 0, "Invalid amount : You must provide pair tokens");

        // Transfer token respectivly to the pool
        uint256 totalSupply = totalSupply();

        uint256 amount0 = token0.balanceOf(address(this));
        uint256 amount1 = token1.balanceOf(address(this));

        token0.safeTransferFrom(msg.sender, address(this), tokenAmount0_);
        token1.safeTransferFrom(msg.sender, address(this), tokenAmount1_);

        // Liquidity minting
        uint256 liquidity;
        if (totalSupply == 0) { 
            // If it's the first liquidity provider
            liquidity = Math.sqrt(tokenAmount0_.mul(tokenAmount1_)).sub(MINIMUM_LIQUIDITY);
            _mint(address(this), MINIMUM_LIQUIDITY);
        } else {
            // Otherwise we determine the reward as stored rate
            liquidity = Math.min(
                tokenAmount0_.mul(totalSupply).div(amount0), 
                tokenAmount1_.mul(totalSupply).div(amount1)
            );
        }
        
        // Update K
        k = amount0.add(tokenAmount0_).mul(amount1.add(tokenAmount1_));

        // Finally mint corresponding amount of liquidity to provider
        _mint(msg.sender, liquidity); 
        
        emit LiquidityProvided(msg.sender, liquidity, tokenAmount0_, tokenAmount1_);
    }

    function removeLiquidity(uint256 liquidity_) external {
        require(liquidity_ > 0, "Invalid amount : You must provide valid amount");
        require(balanceOf(msg.sender) >= liquidity_, "Invalid amount : Insufficient LP token");

        // Store totalSupply before it changes
        uint256 totalSupply = totalSupply();

        _burn(msg.sender, liquidity_);

        uint256 totalAmount0 = token0.balanceOf(address(this));
        uint256 totalAmount1 = token1.balanceOf(address(this));

        // Calculate corresponding amounts respectively
        uint256 tokenAmount0 = liquidity_.mul(totalAmount0).div(totalSupply);
        uint256 tokenAmount1 = liquidity_.mul(totalAmount1).div(totalSupply);

        // Update K as well
        k = totalAmount0.sub(tokenAmount0).mul(totalAmount1.sub(tokenAmount1));

        // Finally refund token pair
        token0.safeTransfer(msg.sender, tokenAmount0);
        token1.safeTransfer(msg.sender, tokenAmount1);

        emit LiquidityRefunded(msg.sender, liquidity_, tokenAmount0, tokenAmount1);
    }

    function swap(uint256 tokenAmount0_, uint256 tokenAmount1_) external {
        require(tokenAmount0_ > 0 || tokenAmount1_ > 0, "Invalid amount : You must provide at least one token");

        uint256 totalSupply0 = token0.balanceOf(address(this));
        uint256 totalSupply1 = token1.balanceOf(address(this));

        require(totalSupply0 >= tokenAmount0_, "Invalid amount : Insufficient token");
        require(totalSupply1 >= tokenAmount1_, "Invalid amount : Insufficient token");
        
        uint256 tokenSwappedAmount1 = 0;
        uint256 tokenSwappedAmount0 = 0;
        
        // We need to deal with bi-directional swap at once

        // Swap token A to token B
        if (tokenAmount0_ > 0) {
            token0.safeTransferFrom(msg.sender, address(this), tokenAmount0_);
            // Keeping the former value of K, calculate amount of token B to be swapped
            tokenSwappedAmount1 = totalSupply1.sub(k.div(totalSupply0.add(tokenAmount0_)));
            token1.safeTransfer(msg.sender, tokenSwappedAmount1);
        }

        // Swap token B to token A in the same logic
        if (tokenAmount1_ > 0) {
            token1.safeTransferFrom(msg.sender, address(this), tokenAmount1_);
            tokenSwappedAmount0 = totalSupply0.sub(k.div(totalSupply1.add(tokenAmount1_)));
            token0.safeTransfer(msg.sender, tokenSwappedAmount0);
        }

        // Consider the truncation division
        k = totalSupply0.add(tokenAmount0_).mul(totalSupply1.add(tokenAmount1_));

        emit Swapped(msg.sender, tokenAmount0_, tokenAmount1_, tokenSwappedAmount1, tokenSwappedAmount0);
    }
}