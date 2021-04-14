pragma solidity ^0.8.0;

import "./GrumpyCoin.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./Ownable.sol";
import "./Context.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IFuelTank.sol";


contract GrumpyFuelTank is Context, Ownable, IFuelTank {
  IUniswapV2Router02 uniswapRouter;

  address uniswapRouterAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  address public grumpyAddress;
  address public meowDAOAddress;

  mapping (address => uint) reclaimableBalances;
  uint public liquidityBalance;

  uint reclaimableGuaranteeTime;

  constructor (address _grumpyAddress) {
    reclaimableGuaranteeTime = block.timestamp + (86400 * 10);
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
    require(msg.sender == meowDAOAddress, "MustBeMeowDao");
    nozzleOpen = true;
  }

  function addTokens(address user, uint amount) external override {
    require(meowDAOAddress != address(0), "MeowDAONotInitialized");
    require(msg.sender == meowDAOAddress, "MustBeMeowDao");
    require(!nozzleOpen, "MustBePhase1");

    require(amount > 100, "amountTooSmall"); 

    uint granule = amount / 100;
    uint reclaimable = granule * 72;
    uint fuel = granule * 25;

    liquidityBalance += fuel;
    reclaimableBalances[user] = reclaimableBalances[user] + reclaimable;
  }

  function reclaimGrumpies() public {
    require(nozzleOpen, "MustBePhase2");
    address sender = msg.sender;
    require(reclaimableBalances[sender] > 0, "BalanceEmpty");

    IERC20(grumpyAddress).transfer(sender, reclaimableBalances[sender]);
    reclaimableBalances[sender] = 0;
  }

  //TODO: pass deadline
  function sellGrumpy(uint256 amount, uint256 amountOutMin) public onlyOwner {
    require(nozzleOpen);
    if (block.timestamp < reclaimableGuaranteeTime) {
      require(amount <= liquidityBalance, "NotEnoughFuel");
      liquidityBalance -= amount;
    }

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
