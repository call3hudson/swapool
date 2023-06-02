// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '../node_modules/hardhat/console.sol';

contract Pool is ERC20 {
  using SafeERC20 for IERC20;
  using SafeMath for uint;

  uint256 public constant MINIMUM_LIQUIDITY = 1e3;

  IERC20 public immutable token0;
  IERC20 public immutable token1;

  uint256 public k;

  event LiquidityProvided(address indexed sender, uint liquidity, uint amount0, uint amount1);
  event LiquidityRefunded(address indexed sender, uint liquidity, uint amount0, uint amount1);
  event Swapped(address indexed sender, uint amount, uint amountSwapped);

  constructor(IERC20 token0_, IERC20 token1_) ERC20('LP Token', 'LPT') {
    token0 = token0_;
    token1 = token1_;
  }

  function addLiquidity(
    uint256 tokenAmount0_,
    uint256 tokenAmount1_,
    uint256 tokenMinimum0_,
    uint256 tokenMinimum1_
  ) external {
    require(
      tokenAmount0_ > 0 && tokenAmount1_ > 0,
      'Invalid amount : You must provide pair tokens'
    );

    // Transfer token respectivly to the pool
    uint256 totalSupply = totalSupply();

    uint256 amount0 = token0.balanceOf(address(this));
    uint256 amount1 = token1.balanceOf(address(this));

    uint256 amount0Needed;
    uint256 amount1Needed;

    // Liquidity minting
    uint256 liquidity;
    if (totalSupply == 0) {
      // If it's the first liquidity provider
      liquidity = Math.sqrt(tokenAmount0_.mul(tokenAmount1_)).sub(MINIMUM_LIQUIDITY);
      (amount0Needed, amount1Needed) = (tokenAmount0_, tokenAmount1_);
      _mint(address(this), MINIMUM_LIQUIDITY);
    } else {
      // Otherwise we determine the reward as stored rate
      if (
        tokenAmount0_.mul(totalSupply).div(amount0) <= tokenAmount1_.mul(totalSupply).div(amount1)
      ) {
        liquidity = tokenAmount0_.mul(totalSupply).div(amount0);
        (amount0Needed, amount1Needed) = (tokenAmount0_, liquidity.mul(amount1).div(totalSupply));
      } else {
        liquidity = tokenAmount1_.mul(totalSupply).div(amount1);
        (amount0Needed, amount1Needed) = (liquidity.mul(amount0).div(totalSupply), tokenAmount1_);
      }
    }

    require(
      amount0Needed >= tokenMinimum0_ && amount1Needed >= tokenMinimum1_,
      'Reverted : Minimum desired amount exceeds'
    );

    // Transfer the value
    token0.safeTransferFrom(msg.sender, address(this), amount0Needed);
    token1.safeTransferFrom(msg.sender, address(this), amount1Needed);

    // Update K
    k = amount0.add(amount0Needed).mul(amount1.add(amount1Needed));

    // Finally mint corresponding amount of liquidity to provider
    _mint(msg.sender, liquidity);

    emit LiquidityProvided(msg.sender, liquidity, amount0Needed, amount1Needed);
  }

  function removeLiquidity(
    uint256 liquidity_,
    uint256 tokenMinimum0_,
    uint256 tokenMinimum1_
  ) external {
    require(liquidity_ > 0, 'Invalid amount : You must provide valid amount');
    require(balanceOf(msg.sender) >= liquidity_, 'Invalid amount : Insufficient LP token');

    // Store totalSupply before it changes
    uint256 totalSupply = totalSupply();

    uint256 totalAmount0 = token0.balanceOf(address(this));
    uint256 totalAmount1 = token1.balanceOf(address(this));

    // Calculate corresponding amounts respectively
    uint256 tokenAmount0 = liquidity_.mul(totalAmount0).div(totalSupply);
    uint256 tokenAmount1 = liquidity_.mul(totalAmount1).div(totalSupply);

    require(
      tokenAmount0 >= tokenMinimum0_ && tokenAmount1 >= tokenMinimum1_,
      'Reverted : Minimum desired amount exceeds'
    );

    _burn(msg.sender, liquidity_);

    // Finally refund token pair
    token0.safeTransfer(msg.sender, tokenAmount0);
    token1.safeTransfer(msg.sender, tokenAmount1);

    // Update K as well
    k = totalAmount0.sub(tokenAmount0).mul(totalAmount1.sub(tokenAmount1));

    emit LiquidityRefunded(msg.sender, liquidity_, tokenAmount0, tokenAmount1);
  }

  function swap(uint256 tokenAmount_, IERC20 tokenAddr_, uint256 tokenMinimum_) external {
    require(tokenAmount_ > 0, 'Invalid amount : You must provide integer amount');
    require(
      tokenAddr_ == token0 || tokenAddr_ == token1,
      'Invalid token addr : You must input valid address'
    );

    IERC20 srcToken = tokenAddr_;
    IERC20 destToken = tokenAddr_ == token0 ? token1 : token0;

    uint256 totalSupply0 = srcToken.balanceOf(address(this));
    uint256 totalSupply1 = destToken.balanceOf(address(this));

    // Keeping the former value of K, calculate amount of token B to be swapped
    uint256 swapAmount = totalSupply1.sub(k.div(totalSupply0.add(tokenAmount_)));
    require(swapAmount >= tokenMinimum_, 'Reverted : Minimum desired amount exceeds');

    srcToken.safeTransferFrom(msg.sender, address(this), tokenAmount_);
    destToken.safeTransfer(msg.sender, swapAmount);

    // Consider the truncation division
    k = totalSupply0.add(tokenAmount_).mul(totalSupply1.sub(swapAmount));

    emit Swapped(msg.sender, tokenAmount_, swapAmount);
  }
}
