// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
 
contract HalpCoin is IERC20Upgradeable, Initializable {

  uint256 _totalSupply;
  string private _name;
  string private _symbol;

  mapping (address => uint256) private _balances;
  //mapping (address => mapping (address => uint256)) private _allowances;

  function initialize() initializer public {
    _name = 'HalpCoin';
    _symbol = 'HALP';
    _totalSupply = 10000000;
  }

  function name() public view returns (string memory) {
    return _name;
  } 

  function symbol() public view returns (string memory) {
    return _symbol;
  }

  //overriding the erc20 spec
  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }


  //don't know if this is needed? we could take the virtual part
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount);
    return true;
  }
  
  function _transfer(address sender, address recipient, uint256 amount) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");

    //_beforeTokenTransfer(sender, recipient, amount); seems like a hook that will be overriden, in the future.

    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
    _balances[sender] = senderBalance - amount;
    _balances[recipient] += amount;

    emit Transfer(sender, recipient, amount);
  }



  function allowance(address owner, address spender) public view virtual override returns (uint256) {
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
