// contracts/Box.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./FixidityLib.sol";

import "./GrumpyCoin.sol";
 
contract HalpCoin is IERC20Upgradeable, Initializable, ContextUpgradeable {
  using FixidityLib for int256;
  using AddressUpgradeable for address;

  uint256 _totalSupply;
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  address grumpyAddress;

  function __HalpCoin_init(address _grumpyAddress) initializer public {
    __Context_init_unchained();
    initialize(_grumpyAddress);
  }

  function initialize(address _grumpyAddress) initializer internal{
    _name = 'MeowDAO';
    _symbol = 'Meow';
    _decimals = 9; //placeholder for now.
    _totalSupply = 0;
    
    //TODO: this needs lots more thinking
    _balances[address(0)] = _totalSupply;

    grumpyAddress = _grumpyAddress;
  }

  event GrumpySwap(address wallet, uint256 amount);

  function _swapGrumpyInternal(address user, uint256 amount) private {
    require(!isStaked(user), "cannot swap into staked wallet");

    Grumpy grumpy = Grumpy(grumpyAddress);
    
    grumpy.transferFrom(user, address(0x000000000000000000000000000000000000dEaD), amount);

    _balances[user] += amount;

    _totalSupply += amount;

    emit GrumpySwap(user, amount);
  }

  function swapGrumpy(uint256 amount) public {
    _swapGrumpyInternal(msg.sender, amount);
  }

  //TODO: REMOVE THIS
  function _swapGrumpyTest(address user, uint256 amount) public {
    _swapGrumpyInternal(user, amount);
  }

  function getBlockTime() public view returns (uint) {
    return block.timestamp;
  }

  mapping (address => uint256) private _balances;
  mapping (address => mapping (address => uint256)) private _allowances;

  //TODO: track stateStart independently of the way currently stakeTimes is used.
  //      stakeStart should not be updated until unstaking, and could be used for nft minting
  mapping (address => uint) public stakeTimes;
  mapping (address => bool) currentlyStaked;
  mapping (address => bool) currentlyLocked;
  mapping (address => address) currentVotes;
  mapping (address => uint256) voteWeights;

  mapping(address => uint256) private voteCounts;
  //TODO: needs initialization
  address[] private voteIterator;
  mapping(address => bool) walletWasVotedFor;
  //TODO: needs initialization
  address currentCharityWallet;

  function getCharityWallet() external view returns (address) {
    return currentCharityWallet;
  }

  function isStaked(address wallet) public view returns (bool) {
    return currentlyStaked[wallet];
  }
  function isUnlocked(address wallet) public view returns (bool) {
    return !currentlyLocked[wallet];
  }

  function stakeCooldownComplete(address wallet) private view returns (bool) {
    return block.timestamp - stakeTimes[wallet] > 86400;
  }

  //TODO: make private, is public for testing
  function _stakeWalletFor(address sender) public returns (bool) {
    require(!isStaked(sender));
    require(_canStake(sender), "InsfcntFnds");

    currentlyStaked[sender] = true;
    currentlyLocked[sender] = false;
    currentVotes[sender] = address(0);
    stakeTimes[sender] = block.timestamp;

    return true;
  }
  function stakeWallet() public returns (bool) {
    return _stakeWalletFor(_msgSender());
  }

  function unstakeWallet() public {
    address sender = _msgSender();

    require(isStaked(sender));

    if (!stakeCooldownComplete(sender)) {
      currentlyLocked[sender] = true;
    }

    else {
      address vote = currentVotes[sender];
      if (vote != address(0)) {
        voteCounts[vote] = voteCounts[vote] - voteWeights[sender];
      }
      reifyYield(sender);

      currentlyStaked[sender] = false;
    }
  }

  function sendFundsToStakedWallet(address recipient,  address wallet, uint256 amount) public {
    require(isStaked(wallet), "the wallet must be staked");
    reifyYield(wallet);
    _transfer(recipient, wallet, amount); 
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

    if (currentCharityWallet != address(0) && currentlyStaked[currentCharityWallet]) {
      stakeTimes[currentCharityWallet] = block.timestamp;
    }

    if (winner != address(0) && currentlyStaked[winner]) {
      reifyYield(winner);
    }

    currentCharityWallet = winner;

  }

  //  removeVote must call recalculateCharityWallet, but addVote doesn't have to
  //  a delegate system might be able to optimize it somewhat

  //0.0000001846468194323
  //0.000000184646819432
  //0.000000093668115524
  //0.000000000936681155

  //100 * (1.07)^(1/31556952)
  //100.0000002144017221509


  //TODO: investigate limits before overflow
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
    return block.timestamp - stakeTimes[wallet];
  }

  function reifyYield(address wallet) public {
    if (currentCharityWallet == wallet) return;
    require(isStaked(wallet), 'MstBeStkd');
    require(isUnlocked(wallet));

    uint compoundingFactor = getCompoundingFactor(wallet);

    if (compoundingFactor < 7200) return;

    emit Trace2(_balances[wallet], compoundingFactor);
    uint256 yield = calculateYield(_balances[wallet], compoundingFactor);
    emit Trace(yield);

    _totalSupply = _totalSupply + (yield * 2);

    stakeTimes[wallet] = block.timestamp;

    _balances[wallet] = _balances[wallet] +  yield;
    emit Trace(yield);
    _balances[currentCharityWallet] = _balances[currentCharityWallet] + yield;
  }

  event Trace2(uint n, uint r);
  event Trace(uint n);

  function _canStake(address wallet) private view returns (bool) {
    return _balances[wallet] > _totalSupply/1000;
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
    _transfer(_msgSender(), recipient, amount); //look at why _msgSender() is used.
    return true;
  }
  
  function _transfer(address sender, address recipient, uint256 amount) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");
    require(!isStaked(sender), "Staked wallets should not be able to transfer tokens");

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
