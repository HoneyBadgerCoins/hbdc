pragma solidity ^0.8.0;

import "./GrumpyCoin.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./Ownable.sol";
import "./interfaces/IERC20.sol";


contract GrumpyFuelTank is Ownable {
  IUniswapV2Router02 uniswapRouter;

  address uniswapRouterAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  address grumpyAddress;
  address meowDAOAddress;

  constructor (address _grumpyAddress) {
    grumpyAddress = _grumpyAddress;
    uniswapRouter = IUniswapV2Router02(uniswapRouterAddress);
  }

  fallback () external payable {}

  function addMeowDAOaddress(address _meowDAOAddress) public onlyOwner {
    require(meowDAOAddress == address(0));
    meowDAOAddress = _meowDAOAddress;
  }

  //TODO: pass deadline
  function sellGrumpy(uint256 amount, uint256 amountOutMin) public onlyOwner {
    IERC20 grumpy = IERC20(grumpyAddress);
    require(grumpy.approve(uniswapRouterAddress, amount), "Could not approve grumpy transfer");

    address[] memory path = new address[](2);
    path[0] = grumpyAddress;
    path[1] = uniswapRouter.WETH();
    uniswapRouter.swapExactTokensForETH(amount, amountOutMin, path, address(this), block.timestamp);
  }

  //must first add allowance to router of amountTokenDesired
  function provideLockedLiquidity(uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, uint deadline) public onlyOwner {
    require(meowDAOAddress != address(0));

    IERC20 meow = IERC20(meowDAOAddress);
    require(meow.approve(uniswapRouterAddress, amountTokenDesired), "Could not approve meow transfer");

    uniswapRouter.addLiquidityETH(
      address(meowDAOAddress),
      amountTokenDesired,
      amountTokenMin,
      amountETHMin,
      address(0x000000000000000000000000000000000000dEaD),
      deadline); 
  }
}
