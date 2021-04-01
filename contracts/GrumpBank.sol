pragma solidity ^0.8.0;

import './Ownable.sol';

contract GrumpBank is Ownable {
  mapping (address => uint256) public oldBalances;
  mapping (address => uint) requisitionTime;
  uint deployedTime;

  address authenticatedAddress;

  constructor() {
    deployedTime = block.timestamp;
  }

  function _testInitAccount(address account) public {
    oldBalances[account] = 200000;
  }

  function setAuthenticatedContract(address erc20) onlyOwner public returns (address) {
    authenticatedAddress = erc20;
    return erc20;
  }
}
