// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./FixidityLib.sol";
import "./interfaces/IFuelTank.sol";

contract MeowDAO is IERC20Upgradeable, Initializable, ContextUpgradeable {
  using FixidityLib for int256;
  using AddressUpgradeable for address;
  using SafeMathUpgradeable for uint256;

  uint256 _totalSupply;
  string private _name;
  string private _symbol;
  uint8 private _decimals;
  uint private _contractStart;

  //need access modifiers.
  address grumpyAddress;
  address grumpyFuelTankAddress;
  uint swapEndTime;
  bool launched;

  uint256 public totalStartingSupply;
  address devWallet;
  uint devFund;

  mapping (address => uint256) private _balances;
  mapping (address => mapping (address => uint256)) private _allowances;

  mapping (address => uint) public periodStart;
  mapping (address => bool) public currentlyStaked;
  mapping (address => bool) public currentlyLocked;
  mapping (address => address) public currentVotes;
  mapping (address => uint256) voteWeights;

  mapping(address => uint256) private voteCounts;
  //TODO: needs initialization
  address[] private voteIterator;
  mapping(address => bool) walletWasVotedFor;
  //TODO: needs initialization
  address currentCharityWallet;

  function __MeowDAO_init(address _grumpyAddress, address _grumpyFuelTankAddress) initializer public {
    __Context_init_unchained();
    initialize(_grumpyAddress, _grumpyFuelTankAddress);
  }

  function initialize(address _grumpyAddress, address _grumpyFuelTankAddress) initializer internal{
    _name = 'MeowDAO';
    _symbol = 'Meow';
    _decimals = 14;
    _totalSupply = 0;
    //TODO: change to real address
    devWallet = address(this);

    _contractStart = block.timestamp;

    grumpyAddress = _grumpyAddress;
    grumpyFuelTankAddress = _grumpyFuelTankAddress;

    totalStartingSupply = 10**9 * 10**14; //1_000_000_000.00_000_000_000_000 1 billion meowdaos. 10^23

    devFund = (totalStartingSupply/40);
    _totalSupply += devFund; 

    swapEndTime = block.timestamp + (86400 * 5);
    launched = false;
  }

  function retrieveDevFunds() public {
    require(devFund != 0, "DevFundsClaimed");
    require(block.timestamp >= _contractStart + (86400 * 356), "Vesting period pending");
    _balances[devWallet] = _balances[devWallet] + devFund;
    emit Transfer(address(0), devWallet, devFund);
    devFund = 0;
  }

  function _swapGrumpyInternal(address user, uint256 amount) private {
    require(block.timestamp < swapEndTime);
    require(!isStaked(user), "cannot swap into staked wallet");

    IERC20Upgradeable grumpy = IERC20Upgradeable(grumpyAddress);
    
    grumpy.transferFrom(user, grumpyFuelTankAddress, amount);
    IFuelTank(grumpyFuelTankAddress).addTokens(user, amount);

    _balances[user] += amount;

    _totalSupply += amount;

    emit Transfer(address(0), user, amount);
  }

  function swapGrumpy(uint256 amount) public {
    _swapGrumpyInternal(msg.sender, amount);
  }

  function _swapGrumpyTest(address user, uint256 amount) public {
    _swapGrumpyInternal(user, amount);
  }

  function _testAdvanceEndTime () external {
    swapEndTime = swapEndTime - (86400 * 10);
  }

  function initializeCoinThruster() external {
    require(block.timestamp >= swapEndTime, "NotReady");
    require(launched == false, "AlreadyLaunched");

    IFuelTank(grumpyFuelTankAddress).openNozzle();

    if (totalStartingSupply > _totalSupply) {
      uint256 remainingTokens = totalStartingSupply - _totalSupply;

      _balances[grumpyFuelTankAddress] = _balances[grumpyFuelTankAddress] + remainingTokens;

      emit Transfer(address(0), grumpyFuelTankAddress, remainingTokens);
    }

    launched = true;
  }

  function getBlockTime() public view returns (uint) {
    return block.timestamp;
  }

  function getCharityWallet() public view returns (address) {
    return currentCharityWallet;
  }

  function isStaked(address wallet) public view returns (bool) {
    return currentlyStaked[wallet];
  }

  function isUnlocked(address wallet) public view returns (bool) {
    return !currentlyLocked[wallet];
  }

  function stakeCooldownComplete(address wallet) private view returns (bool) {
    return block.timestamp - periodStart[wallet] > 432000;
  }

  //TODO: make private, is public for testing
  function _stakeWalletFor(address sender) public returns (bool) {
    require(!isStaked(sender));
    require(_canStake(sender), "InsfcntFnds");

    currentlyStaked[sender] = true;
    currentlyLocked[sender] = false;
    currentVotes[sender] = address(0);
    periodStart[sender] = block.timestamp;

    return true;
  }

  function stakeWallet() public returns (bool) {
    return _stakeWalletFor(_msgSender());
  }

   //TODO: change this to private on release
  function _unstakeWalletFor(address sender, bool shouldReify) public {
    require(isStaked(sender));

    if (!stakeCooldownComplete(sender)) {
      currentlyLocked[sender] = true;
    } else {
      if (shouldReify) reifyYield(sender);

      address vote = currentVotes[sender];
      if (vote != address(0)) {
        voteCounts[vote] = voteCounts[vote] - voteWeights[sender];
        updateCharityWallet();
      }

      currentlyStaked[sender] = false;

      periodStart[sender] = 0;
      currentlyLocked[sender] = false;
      currentVotes[sender] = address(0);
      voteWeights[sender] = 0;
    }
  } 

  function unstakeWallet() public {
    _unstakeWalletFor(_msgSender(), true);
  }

  function unstakeWalletSansReify() public {
    _unstakeWalletFor(_msgSender(), false);
  }

  function sendFundsToStakedWallet(address wallet, uint256 amount) public {
    require(isStaked(wallet), "the wallet must be staked");
    reifyYield(wallet);
    _transfer(_msgSender(), wallet, amount); 
  } 

  //TODO: make this private
  function _voteForAddressBy(address charityWallet, address sender) public {

    require(isStaked(sender));
    require(isUnlocked(sender));

    address vote = currentVotes[sender];
    if (vote != address(0)) {
      voteCounts[vote] = voteCounts[vote] - voteWeights[sender];
    }

    uint256 newVoteWeight = _balances[sender];
    voteWeights[sender] = newVoteWeight;

    // If wallet was never voted for before add it to voteIterator
    if (!walletWasVotedFor[charityWallet]) {
      voteIterator.push(charityWallet);
      walletWasVotedFor[charityWallet] = true;
    }

    voteCounts[charityWallet] = voteCounts[charityWallet] + newVoteWeight;

    currentVotes[sender] = charityWallet;

    updateCharityWallet();
  }

  function voteForAddress(address charityWallet) public {
    _voteForAddressBy(charityWallet, _msgSender());
  }

  event NewCharityWallet(address oldW, address newW);

  function updateCharityWallet() public {
    uint256 maxVoteValue = 0; 
    address winner = address(0);

    for (uint i = 0; i < voteIterator.length; i++) {
      address currentWallet = voteIterator[i];
      uint256 voteValue = voteCounts[currentWallet];

      //TODO: consider implication of zero vote value

      if (voteValue > maxVoteValue) {
        maxVoteValue = voteValue;
        winner = currentWallet;
      }
    }

    if (currentCharityWallet == winner) return;

    emit NewCharityWallet(currentCharityWallet, winner);

    //if old winner was staked
    if (currentCharityWallet != address(0) && currentlyStaked[currentCharityWallet]) {
      //reset their yield period start to the present so they can't double dip
      periodStart[currentCharityWallet] = block.timestamp;
    }

    //if new charrity address is staked
    if (winner != address(0) && currentlyStaked[winner]) {
      //reify the new wallet before they become the currentCharityWallet
      reifyYield(winner);
    }

    currentCharityWallet = winner;
  }

  function calculateYield(uint256 principal, uint n) public pure returns (uint256) {
    int256 fixedPrincipal = int256(principal).newFixed();

    int256 rate = int256(2144017221509).newFixedFraction(1000000000000000000000);
    int256 fixed2 = int256(2).newFixed();

    while (n > 0) {
      if (n % 2 == 1) {
        fixedPrincipal = fixedPrincipal.add(fixedPrincipal.multiply(rate));
        n -= 1;
      }
      else {
        rate = (fixed2.multiply(rate))
          .add(rate.multiply(rate));
        n /= 2;
      }
    }
    return uint256(fixedPrincipal.fromFixed()) - principal;
  }

  function getCompoundingFactor(address wallet) public view returns (uint) {
    return block.timestamp - periodStart[wallet];
  }

  //TODO: public for now need to be private on release
  //TODO: underflow and overflow
  //TODO: do some bounds testing
  function getTransactionFee(uint256 txAmt) public view returns (uint256){
    uint period = block.timestamp - _contractStart;
    uint256 month3 = 7884000;
    uint256 month6 = 15768000;
    uint256 month9 = 23652000;
    uint256 month12= 31536000;

    if(period <= month3) {
      return (txAmt/10000) * 100; //0.01
    } else if (period <= month6) {
      return (txAmt/10000) * 75;  //0.0075
    } else if (period <= month9) {
      return (txAmt/10000) * 50;  //0.0050
    } else if (period <= month12) {
      return (txAmt/10000) * 25;  //0.0025
    } else {
      return 0;
    }
  } 

  function reifyYield(address wallet) public {
    if (currentCharityWallet == wallet) return;
    require(isStaked(wallet), 'MstBeStkd');
    require(isUnlocked(wallet));

    uint compoundingFactor = getCompoundingFactor(wallet);

    if (compoundingFactor < 7200) return;

    uint256 yield = calculateYield(_balances[wallet], compoundingFactor);

    _totalSupply = _totalSupply + (yield * 2);

    periodStart[wallet] = block.timestamp;

    _balances[wallet] = _balances[wallet] +  yield;
    _balances[currentCharityWallet] = _balances[currentCharityWallet] + yield;
  }

  event Trace2(uint n, uint r);
  event Trace(uint n);

  function _canStake(address wallet) private view returns (bool) {
    return _balances[wallet] >= 10000000000000000; //10_000_000.000_000_000 grumpy units, placeholder
  }

  function name() external view returns (string memory) {
    return _name;
  } 

  function symbol() external view returns (string memory) {
    return _symbol;
  }

  function decimals() external view returns (uint8) {
    return _decimals;
  }

  function contractStart() external view returns (uint) {
    return _contractStart;
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    uint b = _balances[account];

    if (isStaked(account) && getCharityWallet() != account) {
      return b + calculateYield(b, getCompoundingFactor(account));
    }
    return b;
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount); //look at why _msgSender() is used.
    return true;
  }
  
  function _transfer(address sender, address recipient, uint256 amount) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");
    require(!isStaked(sender), "StkdWlltCnntTrnsf");

    //_beforeTokenTransfer(sender, recipient, amount); seems like a hook that will be overriden, in the future.
    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");

    address charityWallet = getCharityWallet();

    if(charityWallet == address(0)) {
      _balances[sender] = senderBalance - amount;
      _balances[recipient] += amount;

    } else {
      uint256 txFee = getTransactionFee(amount);
      if (txFee != 0) { //after 12 month this wouldn't matter.
        _balances[charityWallet] += txFee;
        amount -= txFee;
       _balances[recipient] += amount;
      }
    }

    emit Transfer(sender, recipient, amount);
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public override returns (bool) {
    _approve(_msgSender(), spender, amount); //_msgSender()
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

    uint256 currentAllowance = _allowances[sender][_msgSender()];
    require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
    _approve(sender, _msgSender(), currentAllowance - amount);

    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
    uint256 currentAllowance = _allowances[_msgSender()][spender];
    require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
    _approve(_msgSender(), spender, currentAllowance - subtractedValue);
    return true;
  }
}
