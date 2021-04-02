pragma solidity ^0.8.0;

import './Ownable.sol';

contract GrumpBank is Ownable {
  mapping (address => uint256) public oldBalances;
  mapping (address => uint) requisitionTime;
  uint deployedTime;

  uint256 constant withdrawalRate = 10000000000;

  address authenticatedAddress;

  constructor() {
    deployedTime = block.timestamp;
  }

  function _testInitAccount(address account, uint256 amount) public {
    oldBalances[account] = amount;
  }

  function setAuthorizedContract(address erc20) onlyOwner public returns (address) {
    authenticatedAddress = erc20;
    return erc20;
  }

  event Trace(uint n);

  function requisitionTokens(address onBehalfOf) public returns (uint256) {
    require(msg.sender == authenticatedAddress, "unauthedAddr");
    uint256 userBalance = oldBalances[onBehalfOf];

    emit Trace(0);

    require(userBalance > 0, "user balance is 0");

    emit Trace(1);

    uint lastWithdrawal = requisitionTime[onBehalfOf];
    if (lastWithdrawal == 0) {
      lastWithdrawal = deployedTime - 86400;
    }

    emit Trace(2);

    uint timeSinceWithdrawal = block.timestamp - lastWithdrawal;
    require(timeSinceWithdrawal > 0, "0TimePassed");

    emit Trace(3);

    uint256 withdrawalPeriods = timeSinceWithdrawal / 86400;

    uint256 maxWithdrawal = withdrawalPeriods * withdrawalRate;

    if (userBalance > maxWithdrawal) {
      oldBalances[onBehalfOf] = oldBalances[onBehalfOf] - maxWithdrawal; 
      requisitionTime[onBehalfOf] = block.timestamp;
      return maxWithdrawal;
    }
    else {
      oldBalances[onBehalfOf] = 0;
      return userBalance;
    }
  }
}
