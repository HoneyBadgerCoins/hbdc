// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IFuelTank.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract HoneyBadgerTank is Context, Ownable, IFuelTank {
  IUniswapV2Router02 uniswapRouter;

  address uniswapRouterAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
  address public honeyBadgerAddress;
  address public hbdcAddress;

  mapping (address => uint) public reclaimableBalances;
  uint public liquidityBalance;

  uint public reclaimGuaranteeTime;
  uint public reclaimStartTime;

  constructor (address _honeyBadgerAddress) {
    honeyBadgerAddress = _honeyBadgerAddress;
    uniswapRouter = IUniswapV2Router02(uniswapRouterAddress);
  }

  function addHBDCaddress(address _hbdcAddress) public onlyOwner {
    require(hbdcAddress == address(0));
    hbdcAddress = _hbdcAddress;
  }

  bool public nozzleOpen = false;
  function openNozzle() external override {
    require(!nozzleOpen, "AlreadyOpen");
    require(hbdcAddress != address(0), "HBDCNotInitialized");
    require(msg.sender == hbdcAddress, "MustBeHBDC");

    reclaimStartTime = block.timestamp + (86400 * 2);
    reclaimGuaranteeTime = block.timestamp + (86400 * 9);

    nozzleOpen = true;
  }

  function addTokens(address user, uint amount) external override {
    require(hbdcAddress != address(0), "HBDCNotInitialized");
    require(msg.sender == hbdcAddress, "MustBeHBDC");
    require(!nozzleOpen, "MustBePhase1");

    require(amount > 100, "amountTooSmall"); 

    uint granule = amount / 100;
    uint reclaimable = granule * 0;
    uint fuel = granule * 100;

    liquidityBalance += fuel;
    reclaimableBalances[user] = reclaimableBalances[user] + reclaimable;
  }

  function reclaimHoneyBadgers() public {
    require(nozzleOpen, "Phase1");
    require(block.timestamp >= reclaimStartTime, "Phase2");
    address sender = msg.sender;
    require(reclaimableBalances[sender] > 0, "BalanceEmpty");

    IERC20(honeyBadgerAddress).transfer(sender, reclaimableBalances[sender]);
    reclaimableBalances[sender] = 0;
  }

  function sellHoneyBadger(uint256 amount, uint256 amountOutMin) public onlyOwner {
    require(nozzleOpen);
    if (block.timestamp < reclaimGuaranteeTime) {
      require(amount <= liquidityBalance, "NotEnoughFuel");
      liquidityBalance -= amount;
    }

    IERC20 honeybadger = IERC20(honeyBadgerAddress);
    require(honeybadger.approve(uniswapRouterAddress, amount), "Could not approve honeybadger transfer");

    address[] memory path = new address[](2);
    path[0] = honeyBadgerAddress;
    path[1] = uniswapRouter.WETH();
    uniswapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, amountOutMin, path, address(this), block.timestamp);
  }

  function provideLockedLiquidity(
        uint amountWETHDesired, uint amountHBDCDesired,
        uint amountWETHMin, uint amountHBDCMin,
        uint deadline) public onlyOwner {

    require(nozzleOpen);
    require(hbdcAddress != address(0));

    address wethAddress = uniswapRouter.WETH();

    require(IERC20(wethAddress).approve(uniswapRouterAddress, amountWETHDesired),
      "Could not approve WETH transfer");

    require(IERC20(hbdcAddress).approve(uniswapRouterAddress, amountHBDCDesired),
      "Could not approve HBDC transfer");

    uniswapRouter.addLiquidity(
      uniswapRouter.WETH(),
      hbdcAddress,
      amountWETHDesired,
      amountHBDCDesired,
      amountWETHMin,
      amountHBDCMin,
      address(0x000000000000000000000000000000000000dEaD),
      deadline); 
  }
}