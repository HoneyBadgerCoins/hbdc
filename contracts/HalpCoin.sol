// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
 
contract HalpCoin is IERC20Upgradeable, Initializable {

  uint256 _totalSupply;
  string private _name;
  string private _symbol;

  function initialize() initializer public {
    _name = 'HalpCoin';
    _symbol = 'HALP';
    _totalSupply = 10000000;
  }

  mapping (address => uint256) private _balances;

  using SafeMathUpgradeable for uint256;
  using AddressUpgradeable for address;

  uint256 _totalSupply;
  mapping (address => uint256) private _balances;

  struct StakedWallet {
    address owner;
    uint stakeTime;
    bool currentlyStaked;
    address currentVote;
  }

  //needs initialization, don't use 0 index
  StakedWallet[] public staked;
  mapping(address => uint) private stakedWalletIndices;

  function getStakedWallets() public view returns (uint[] memory) {
      uint[] memory result = new uint[](staked.length - 1);
      uint counter = 0;
      
      for (uint i = 1; i < staked.length; i++) {
          if (staked[i].currentlyStaked == true) {
              result[counter] = i;
              counter++;
          }
      }
      return result;
  }


  function stake() public returns (bool) {
    address sender = msg.sender;
    require(_canStake(sender), "Wallet needs sufficient funds to stake");

    uint stakeIndex = stakedWalletIndices[sender]; 
    if (stakeIndex != 0) {
      staked.push(StakedWallet({owner: sender, stakeTime: block.timestamp, currentlyStaked: true}));
    }
    else {
      StakedWallet storage oldStake = staked[stakeIndex];
      oldStake.stakeTime = block.timestamp;
      oldStake.currentlyStaked = true;
      oldStake.currentVote = address(0);
    }

    return true;
  }

  //function unstake() public {
  //TODO:
  //  ensure stakeTime is sufficiently past
  //  if (voted)
  //    remove vote weight from currentVote
  //    updateCharityWallet()
  //  reifyYield
  //  set staked to false

  //function vote(address charityWallet) public {
  //TODO:
  //  ensure staked
  //  reifyYield
  //  somehow add wallet weight to address 
  //  track currentVote
  //  updateCharityWallet()

  //function updateCharityWallet
  //TODO: ??????????
  //  maybe can be broken into 3 functions
  //    addVote
  //    recalculateCharityWallet
  //    removeVote
  //  removeVote must call recalculateCharityWallet, but addVote doesn't have to
  //  a delegate system might be able to optimize it somewhat

  function getYield(StakedWallet memory stakedWallet) public pure returns (uint256) {
    //TODO: calculate interest based on time since staking
    return 0;
  }

  function reifyYield(address wallet) public {
    uint wasStaked = stakedWalletIndices[wallet];
    require(wasStaked != 0);

    StakedWallet storage stakedWallet = staked[wasStaked];
    require(stakedWallet.currentlyStaked == true);

    uint yield = getYield(stakedWallet);

    //TODO: track yield in totalSupply

    stakedWallet.stakeTime = block.timestamp;

    _balances[wallet] = _balances[wallet].add(yield);
    _balances[charityWallet] = _balances[charityWallet].add(yield);
  }

  function _canStake(address wallet) private view returns (bool) {
    //requires certain portion of totalSupply
    return false;
  }

  function name() external view returns (string memory) {
    return _name;
  } 

  function symbol() external view returns (string memory) {
    return _symbol;
  }

  //overriding the erc20 spec
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  //this can be changed into external, if not called internally
  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }


  //don't know if this is needed? we could take the virtual part
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount); //look at why _msgSender() is used.
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
    return _allowances[owner][spender];
  }

  
  function approve(address spender, uint256 amount) public override returns (bool) {
    _approve(msg.sender, spender, amount); //_msgSender()
    return true;

  }

  function _approve(address owner, address spender, uint256 amount) internal virtual {
    require(owner != address(0), "ERC20: approve from the zero address");
    require(spender != address(0), "ERC20: approve to the zero address");

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }


  function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
    _transfer(sender, recipient, amount);

    uint256 currentAllowance = _allowances[sender][msg.sender];
    require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
    _approve(sender, msg.sender, currentAllowance - amount);

    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
    uint256 currentAllowance = _allowances[msg.sender][spender];
    require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
    _approve(msg.sender, spender, currentAllowance - subtractedValue);
    return true;
  }
}
