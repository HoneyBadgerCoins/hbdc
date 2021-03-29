// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
 
contract HalpCoin is IERC20Upgradeable, Initializable {
  uint256 _totalSupply;

  function initialize() initializer public {
    _totalSupply = 10000000;
  }

  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public pure override returns (uint256) {
    return 0;
  }

  function transfer(address recipient, uint256 amount) public pure override returns (bool) {
    return true;
  }

  function allowance(address owner, address spender) public pure override returns (uint256) {
    return 0;
  }

  function approve(address spender, uint256 amount) public pure override returns (bool) {
    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public pure override returns (bool) {
    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public pure virtual returns (bool) {
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public pure virtual returns (bool) {
    return true;
  }
}
