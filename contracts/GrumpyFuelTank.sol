pragma solidity ^0.8.0;

import "./GrumpyCoin.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./Ownable.sol";
import "./Context.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IIgnitionSwitch.sol";


contract GrumpyFuelTank is Context, Ownable, IIgnitionSwitch {
  IUniswapV2Router02 uniswapRouter;

  address uniswapRouterAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  address public grumpyAddress;
  address public meowDAOAddress;

  constructor (address _grumpyAddress) {
    grumpyAddress = _grumpyAddress;
    uniswapRouter = IUniswapV2Router02(uniswapRouterAddress);
  }

  function addMeowDAOaddress(address _meowDAOAddress) public onlyOwner {
    require(meowDAOAddress == address(0));
    meowDAOAddress = _meowDAOAddress;
  }

  bool nozzleOpen = false;
  function openNozzle() external override {
    require(meowDAOAddress != address(0), "MeowDAONotInitialized");
    require(_msgSender() == meowDAOAddress, "MustBeMeowDao");
    nozzleOpen = true;
  }

  //TODO: pass deadline
  function sellGrumpy(uint256 amount, uint256 amountOutMin) public onlyOwner {
    require(nozzleOpen);
    IERC20 grumpy = IERC20(grumpyAddress);
    require(grumpy.approve(uniswapRouterAddress, amount), "Could not approve grumpy transfer");

    address[] memory path = new address[](2);
    path[0] = grumpyAddress;
    path[1] = uniswapRouter.WETH();
    uniswapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, amountOutMin, path, address(this), block.timestamp);
  }

  function provideLockedLiquidity(
        uint amountWETHDesired, uint amountMEOWDesired,
        uint amountWETHMin, uint amountMEOWMin,
        uint deadline) public onlyOwner {

    require(nozzleOpen);
    require(meowDAOAddress != address(0));

    address wethAddress = uniswapRouter.WETH();

    require(IERC20(wethAddress).approve(uniswapRouterAddress, amountWETHDesired),
      "Could not approve WETH transfer");

    require(IERC20(meowDAOAddress).approve(uniswapRouterAddress, amountMEOWDesired),
      "Could not approve MEOW transfer");

    uniswapRouter.addLiquidity(
      uniswapRouter.WETH(),
      meowDAOAddress,
      amountWETHDesired,
      amountMEOWDesired,
      amountWETHMin,
      amountMEOWMin,
      address(0x000000000000000000000000000000000000dEaD),
      deadline); 
  }
}
