// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./FixidityLib.sol";
import "./interfaces/SafeMath.sol";
import "./interfaces/Ownable.sol";
import "./interfaces/SafeMathInt.sol";
import "./interfaces/IFuelTank.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Router01.sol";
import "./interfaces/IUniswapV2Router02.sol";


contract HBDC is IERC20, Ownable {
  using FixidityLib for int256;

  IUniswapV2Router02 public immutable uniswapV2Router;
    address public immutable uniswapV2Pair;
    address public constant deadAddress = address(0xdead);

    bool private swapping;

    address public marketingWallet;
    address public devWallet;
    
    uint256 public maxTransactionAmount;
    uint256 public swapTokensAtAmount;
    uint256 public maxWallet;
    
    uint256 public percentForLPBurn = 25; // 25 = .25%
    bool public lpBurnEnabled = true;
    uint256 public lpBurnFrequency = 3600 seconds;
    uint256 public lastLpBurnTime;
    
    uint256 public manualBurnFrequency = 30 minutes;
    uint256 public lastManualLpBurnTime;

    bool public limitsInEffect = true;
    bool public tradingActive = false;
    bool public swapEnabled = false;
    
     // Anti-bot and anti-whale mappings and variables
    mapping(address => uint256) private _holderLastTransferTimestamp; // to hold last Transfers temporarily during launch
    bool public transferDelayEnabled = true;

    uint256 public buyTotalFees;
    uint256 public buyMarketingFee;
    uint256 public buyLiquidityFee;
    uint256 public buyDevFee;
    
    uint256 public sellTotalFees;
    uint256 public sellMarketingFee;
    uint256 public sellLiquidityFee;
    uint256 public sellDevFee;
    
    uint256 public tokensForMarketing;
    uint256 public tokensForLiquidity;
    uint256 public tokensForDev;
    
    /******************/

  
  string private _name = "HoneyBadger";
  string private _symbol = 'HBDC';

  uint8 private _decimals = 18;
  uint private _contractStart;

  address public HoneyBadgerAddress;
  address public HoneyBadgerFuelTankAddress;
  uint public swapEndTime;

  bool public launched = false;

  uint256 public totalStartingSupply = 10**9 * 10**18; //10_000_000_000.0_000_000_000_000 10 billion MEOWS. 10^23

  mapping (address => uint256) private _balances;
  mapping (address => mapping (address => uint256)) private _allowances;

  mapping (address => uint) public periodStart;
  mapping (address => bool) public currentlyStaked;
  mapping (address => uint) public unlockStartTime;
  mapping (address => address) public currentVotes;
  mapping (address => uint256) public voteWeights;

  mapping (address => uint256) public stakingCoordinatesTime;
  mapping (address => uint256) public stakingCoordinatesAmount;

  mapping(address => uint256) public voteCounts;
  address[] public voteIterator;
  mapping(address => bool) public walletWasVotedFor;
  address public currentCharityWallet;

  // exlcude from fees and max transaction amount
    mapping (address => bool) private _isExcludedFromFees;
    mapping (address => bool) public _isExcludedMaxTransactionAmount;

    // store addresses that a automatic market maker pairs. Any transfer *to* these addresses
    // could be subject to a maximum transfer amount
    mapping (address => bool) public automatedMarketMakerPairs;

    event UpdateUniswapV2Router(address indexed newAddress, address indexed oldAddress);

    event ExcludeFromFees(address indexed account, bool isExcluded);

    event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);

    event marketingWalletUpdated(address indexed newWallet, address indexed oldWallet);
    
    event devWalletUpdated(address indexed newWallet, address indexed oldWallet);

    event SwapAndLiquify(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 tokensIntoLiquidity
    );
    
    event AutoNukeLP();
    
    event ManualNukeLP();

  constructor(address _HoneyBadgerAddress, address _HoneyBadgerFuelTankAddress) {
    _contractStart = block.timestamp;

    HoneyBadgerAddress = _HoneyBadgerAddress;
    HoneyBadgerFuelTankAddress = _HoneyBadgerFuelTankAddress;

    swapEndTime = block.timestamp + (86400 * 5);
  }

  constructor() {
        
        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
        
        excludeFromMaxTransaction(address(_uniswapV2Router), true);
        uniswapV2Router = _uniswapV2Router;
        
        uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory()).createPair(address(this), _uniswapV2Router.WETH());
        excludeFromMaxTransaction(address(uniswapV2Pair), true);
        _setAutomatedMarketMakerPair(address(uniswapV2Pair), true);
        
        uint256 _buyMarketingFee = 4;
        uint256 _buyLiquidityFee = 10;
        uint256 _buyDevFee = 1;

        uint256 _sellMarketingFee = 5;
        uint256 _sellLiquidityFee = 14;
        uint256 _sellDevFee = 1;
        
        uint256 totalSupply = 1 * 1e12 * 1e18;
        
        maxTransactionAmount = totalSupply * 1 / 1000; // 0.1% maxTransactionAmountTxn
        maxWallet = totalSupply * 5 / 1000; // .5% maxWallet
        swapTokensAtAmount = totalSupply * 5 / 10000; // 0.05% swap wallet

        buyMarketingFee = _buyMarketingFee;
        buyLiquidityFee = _buyLiquidityFee;
        buyDevFee = _buyDevFee;
        buyTotalFees = buyMarketingFee + buyLiquidityFee + buyDevFee;
        
        sellMarketingFee = _sellMarketingFee;
        sellLiquidityFee = _sellLiquidityFee;
        sellDevFee = _sellDevFee;
        sellTotalFees = sellMarketingFee + sellLiquidityFee + sellDevFee;
        
        marketingWallet = address(owner()); // set as marketing wallet
        devWallet = address(owner()); // set as dev wallet

        // exclude from paying fees or having max transaction amount
        excludeFromFees(owner(), true);
        excludeFromFees(address(this), true);
        excludeFromFees(address(0xdead), true);
        
        excludeFromMaxTransaction(owner(), true);
        excludeFromMaxTransaction(address(this), true);
        excludeFromMaxTransaction(address(0xdead), true);
        
        /*
            _mint is an internal function in ERC20.sol that is only called here,
            and CANNOT be called ever again
        */
        _mint(msg.sender, totalSupply);
    }

    receive() external payable {

    }

    // once enabled, can never be turned off
    function enableTrading() external onlyOwner {
        tradingActive = true;
        swapEnabled = true;
        lastLpBurnTime = block.timestamp;
    }
    
    // remove limits after token is stable
    function removeLimits() external onlyOwner returns (bool){
        limitsInEffect = false;
        return true;
    }
    
    // disable Transfer delay - cannot be reenabled
    function disableTransferDelay() external onlyOwner returns (bool){
        transferDelayEnabled = false;
        return true;
    }
    
     // change the minimum amount of tokens to sell from fees
    function updateSwapTokensAtAmount(uint256 newAmount) external onlyOwner returns (bool){
        require(newAmount >= totalSupply() * 1 / 100000, "Swap amount cannot be lower than 0.001% total supply.");
        require(newAmount <= totalSupply() * 5 / 1000, "Swap amount cannot be higher than 0.5% total supply.");
        swapTokensAtAmount = newAmount;
        return true;
    }
    
    function updateMaxTxnAmount(uint256 newNum) external onlyOwner {
        require(newNum >= (totalSupply() * 1 / 1000)/1e18, "Cannot set maxTransactionAmount lower than 0.1%");
        maxTransactionAmount = newNum * (10**18);
    }

    function updateMaxWalletAmount(uint256 newNum) external onlyOwner {
        require(newNum >= (totalSupply() * 5 / 1000)/1e18, "Cannot set maxWallet lower than 0.5%");
        maxWallet = newNum * (10**18);
    }
    
    function excludeFromMaxTransaction(address updAds, bool isEx) public onlyOwner {
        _isExcludedMaxTransactionAmount[updAds] = isEx;
    }
    
    // only use to disable contract sales if absolutely necessary (emergency use only)
    function updateSwapEnabled(bool enabled) external onlyOwner(){
        swapEnabled = enabled;
    }
    
    function updateBuyFees(uint256 _marketingFee, uint256 _liquidityFee, uint256 _devFee) external onlyOwner {
        buyMarketingFee = _marketingFee;
        buyLiquidityFee = _liquidityFee;
        buyDevFee = _devFee;
        buyTotalFees = buyMarketingFee + buyLiquidityFee + buyDevFee;
        require(buyTotalFees <= 20, "Must keep fees at 20% or less");
    }
    
    function updateSellFees(uint256 _marketingFee, uint256 _liquidityFee, uint256 _devFee) external onlyOwner {
        sellMarketingFee = _marketingFee;
        sellLiquidityFee = _liquidityFee;
        sellDevFee = _devFee;
        sellTotalFees = sellMarketingFee + sellLiquidityFee + sellDevFee;
        require(sellTotalFees <= 25, "Must keep fees at 25% or less");
    }

    function excludeFromFees(address account, bool excluded) public onlyOwner {
        _isExcludedFromFees[account] = excluded;
        emit ExcludeFromFees(account, excluded);
    }

    function setAutomatedMarketMakerPair(address pair, bool value) public onlyOwner {
        require(pair != uniswapV2Pair, "The pair cannot be removed from automatedMarketMakerPairs");

        _setAutomatedMarketMakerPair(pair, value);
    }

    function _setAutomatedMarketMakerPair(address pair, bool value) private {
        automatedMarketMakerPairs[pair] = value;

        emit SetAutomatedMarketMakerPair(pair, value);
    }

    function updateMarketingWallet(address newMarketingWallet) external onlyOwner {
        emit marketingWalletUpdated(newMarketingWallet, marketingWallet);
        marketingWallet = newMarketingWallet;
    }
    
    function updateDevWallet(address newWallet) external onlyOwner {
        emit devWalletUpdated(newWallet, devWallet);
        devWallet = newWallet;
    }
    

    function isExcludedFromFees(address account) public view returns(bool) {
        return _isExcludedFromFees[account];
    }
    
    event BoughtEarly(address indexed sniper);

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        
         if(amount == 0) {
            super._transfer(from, to, 0);
            return;
        }
        
        if(limitsInEffect){
            if (
                from != owner() &&
                to != owner() &&
                to != address(0) &&
                to != address(0xdead) &&
                !swapping
            ){
                if(!tradingActive){
                    require(_isExcludedFromFees[from] || _isExcludedFromFees[to], "Trading is not active.");
                }

                // at launch if the transfer delay is enabled, ensure the block timestamps for purchasers is set -- during launch.  
                if (transferDelayEnabled){
                    if (to != owner() && to != address(uniswapV2Router) && to != address(uniswapV2Pair)){
                        require(_holderLastTransferTimestamp[tx.origin] < block.number, "_transfer:: Transfer Delay enabled.  Only one purchase per block allowed.");
                        _holderLastTransferTimestamp[tx.origin] = block.number;
                    }
                }
                 
                //when buy
                if (automatedMarketMakerPairs[from] && !_isExcludedMaxTransactionAmount[to]) {
                        require(amount <= maxTransactionAmount, "Buy transfer amount exceeds the maxTransactionAmount.");
                        require(amount + balanceOf(to) <= maxWallet, "Max wallet exceeded");
                }
                
                //when sell
                else if (automatedMarketMakerPairs[to] && !_isExcludedMaxTransactionAmount[from]) {
                        require(amount <= maxTransactionAmount, "Sell transfer amount exceeds the maxTransactionAmount.");
                }
                else if(!_isExcludedMaxTransactionAmount[to]){
                    require(amount + balanceOf(to) <= maxWallet, "Max wallet exceeded");
                }
            }
        }
        
        
        
        uint256 contractTokenBalance = balanceOf(address(this));
        
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;

        if( 
            canSwap &&
            swapEnabled &&
            !swapping &&
            !automatedMarketMakerPairs[from] &&
            !_isExcludedFromFees[from] &&
            !_isExcludedFromFees[to]
        ) {
            swapping = true;
            
            swapBack();

            swapping = false;
        }
        
        if(!swapping && automatedMarketMakerPairs[to] && lpBurnEnabled && block.timestamp >= lastLpBurnTime + lpBurnFrequency && !_isExcludedFromFees[from]){
            autoBurnLiquidityPairTokens();
        }

        bool takeFee = !swapping;

        // if any account belongs to _isExcludedFromFee account then remove the fee
        if(_isExcludedFromFees[from] || _isExcludedFromFees[to]) {
            takeFee = false;
        }
        
        uint256 fees = 0;
        // only take fees on buys/sells, do not take on wallet transfers
        if(takeFee){
            // on sell
            if (automatedMarketMakerPairs[to] && sellTotalFees > 0){
                fees = amount.mul(sellTotalFees).div(100);
                tokensForLiquidity += fees * sellLiquidityFee / sellTotalFees;
                tokensForDev += fees * sellDevFee / sellTotalFees;
                tokensForMarketing += fees * sellMarketingFee / sellTotalFees;
            }
            // on buy
            else if(automatedMarketMakerPairs[from] && buyTotalFees > 0) {
                fees = amount.mul(buyTotalFees).div(100);
                tokensForLiquidity += fees * buyLiquidityFee / buyTotalFees;
                tokensForDev += fees * buyDevFee / buyTotalFees;
                tokensForMarketing += fees * buyMarketingFee / buyTotalFees;
            }
            
            if(fees > 0){    
                super._transfer(from, address(this), fees);
            }
            
            amount -= fees;
        }

        super._transfer(from, to, amount);
    }

    function swapTokensForEth(uint256 tokenAmount) private {

        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
        
    }
    
    
    
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // add the liquidity
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            deadAddress,
            block.timestamp
        );
    }

    function swapBack() private {
        uint256 contractBalance = balanceOf(address(this));
        uint256 totalTokensToSwap = tokensForLiquidity + tokensForMarketing + tokensForDev;
        bool success;
        
        if(contractBalance == 0 || totalTokensToSwap == 0) {return;}

        if(contractBalance > swapTokensAtAmount * 20){
          contractBalance = swapTokensAtAmount * 20;
        }
        
        // Halve the amount of liquidity tokens
        uint256 liquidityTokens = contractBalance * tokensForLiquidity / totalTokensToSwap / 2;
        uint256 amountToSwapForETH = contractBalance.sub(liquidityTokens);
        
        uint256 initialETHBalance = address(this).balance;

        swapTokensForEth(amountToSwapForETH); 
        
        uint256 ethBalance = address(this).balance.sub(initialETHBalance);
        
        uint256 ethForMarketing = ethBalance.mul(tokensForMarketing).div(totalTokensToSwap);
        uint256 ethForDev = ethBalance.mul(tokensForDev).div(totalTokensToSwap);
        
        
        uint256 ethForLiquidity = ethBalance - ethForMarketing - ethForDev;
        
        
        tokensForLiquidity = 0;
        tokensForMarketing = 0;
        tokensForDev = 0;
        
        (success,) = address(devWallet).call{value: ethForDev}("");
        
        if(liquidityTokens > 0 && ethForLiquidity > 0){
            addLiquidity(liquidityTokens, ethForLiquidity);
            emit SwapAndLiquify(amountToSwapForETH, ethForLiquidity, tokensForLiquidity);
        }
        
        
        (success,) = address(marketingWallet).call{value: address(this).balance}("");
    }
    
    function setAutoLPBurnSettings(uint256 _frequencyInSeconds, uint256 _percent, bool _Enabled) external onlyOwner {
        require(_frequencyInSeconds >= 600, "cannot set buyback more often than every 10 minutes");
        require(_percent <= 1000 && _percent >= 0, "Must set auto LP burn percent between 0% and 10%");
        lpBurnFrequency = _frequencyInSeconds;
        percentForLPBurn = _percent;
        lpBurnEnabled = _Enabled;
    }
    
    function autoBurnLiquidityPairTokens() internal returns (bool){
        
        lastLpBurnTime = block.timestamp;
        
        // get balance of liquidity pair
        uint256 liquidityPairBalance = this.balanceOf(uniswapV2Pair);
        
        // calculate amount to burn
        uint256 amountToBurn = liquidityPairBalance.mul(percentForLPBurn).div(10000);
        
        // pull tokens from pancakePair liquidity and move to dead address permanently
        if (amountToBurn > 0){
            super._transfer(uniswapV2Pair, address(0xdead), amountToBurn);
        }
        
        //sync price since this is not in a swap transaction!
        IUniswapV2Pair pair = IUniswapV2Pair(uniswapV2Pair);
        pair.sync();
        emit AutoNukeLP();
        return true;
    }

    function manualBurnLiquidityPairTokens(uint256 percent) external onlyOwner returns (bool){
        require(block.timestamp > lastManualLpBurnTime + manualBurnFrequency , "Must wait for cooldown to finish");
        require(percent <= 1000, "May not nuke more than 10% of tokens in LP");
        lastManualLpBurnTime = block.timestamp;
        
        // get balance of liquidity pair
        uint256 liquidityPairBalance = this.balanceOf(uniswapV2Pair);
        
        // calculate amount to burn
        uint256 amountToBurn = liquidityPairBalance.mul(percent).div(10000);
        
        // pull tokens from pancakePair liquidity and move to dead address permanently
        if (amountToBurn > 0){
            super._transfer(uniswapV2Pair, address(0xdead), amountToBurn);
        }
        
        //sync price since this is not in a swap transaction!
        IUniswapV2Pair pair = IUniswapV2Pair(uniswapV2Pair);
        pair.sync();
        emit ManualNukeLP();
        return true;
    }

  function _swapHoneyBadgerInternal(address user, uint256 amount) private {
    require(block.timestamp < swapEndTime);
    require(!isStaked(user), "cannot swap into staked wallet");
    
    IERC20(HoneyBadgerAddress).transferFrom(user, HoneyBadgerFuelTankAddress, amount);
    IFuelTank(HoneyBadgerFuelTankAddress).addTokens(user, amount);

    _balances[user] += amount;

    _totalSupply += amount;

    emit Transfer(address(0), user, amount);
  }

  function swapHoneyBadger(uint256 amount) public {
    _swapHoneyBadgerInternal(_msgSender(), amount);
  }

  function initializeCoinThruster() external {
    require(block.timestamp >= swapEndTime, "NotReady");
    require(launched == false, "AlreadyLaunched");

    IFuelTank(HoneyBadgerFuelTankAddress).openNozzle();

    if (totalStartingSupply > _totalSupply) {
      uint256 remainingTokens = totalStartingSupply - _totalSupply;

      _balances[HoneyBadgerFuelTankAddress] = _balances[HoneyBadgerFuelTankAddress] + remainingTokens;
      _totalSupply += remainingTokens;

      emit Transfer(address(0), HoneyBadgerFuelTankAddress, remainingTokens);
    }

    launched = true;
  }

  function getBlockTime() public view returns (uint) {
    return block.timestamp;
  }

  function isStaked(address wallet) public view returns (bool) {
    return currentlyStaked[wallet];
  }

  function isUnlocked(address wallet) private returns (bool) {
    uint unlockStarted = unlockStartTime[wallet];

    if (unlockStarted == 0) return true;

    uint unlockedAt = unlockStarted + (86400 * 5);

    if (block.timestamp > unlockedAt) {
      unlockStartTime[wallet] = 0;
      return true;
    }
    else return false;
  }

  function _stakeWalletFor(address sender) private returns (bool) {
    require(!isStaked(sender));
    require(enoughFundsToStake(sender), "InsfcntFnds");
    require(isUnlocked(sender), "WalletIsLocked");

    currentlyStaked[sender] = true;
    unlockStartTime[sender] = 0;
    currentVotes[sender] = address(0);
    periodStart[sender] = block.timestamp;

    stakingCoordinatesTime[sender] = block.timestamp;
    stakingCoordinatesAmount[sender] = _balances[sender];

    return true;
  }

  function stakeWallet() public returns (bool) {
    return _stakeWalletFor(_msgSender());
  }

  function _unstakeWalletFor(address sender, bool shouldReify) private {
    require(isStaked(sender));

    if (shouldReify) reifyYield(sender);

    if (voteWeights[sender] != 0) {
      removeVoteWeight(sender);
      updateCharityWallet();
    }

    currentlyStaked[sender] = false;
    currentVotes[sender] = address(0);
    voteWeights[sender] = 0;
    periodStart[sender] = 0;

    stakingCoordinatesTime[sender] = 0;
    stakingCoordinatesAmount[sender] = 0;

    unlockStartTime[sender] = block.timestamp;
  } 

  function unstakeWallet() public {
    _unstakeWalletFor(_msgSender(), true);
  }

  function unstakeWalletSansReify() public {
    _unstakeWalletFor(_msgSender(), false);
  }

  function voteIteratorLength() external view returns (uint) {
    return voteIterator.length;
  }

  function voteWithRebuildIfNecessary(address charityWalletVote) public {
    if (voteIterator.length == 12 && !walletWasVotedFor[charityWalletVote]) {
      rebuildVotingIterator();
    }
    _voteForAddressBy(charityWalletVote, _msgSender());
  }

  function rebuildVotingIterator() public {
    require(voteIterator.length == 12, "Voting Iterator not full");

    address[12] memory voteCopy;
    for (uint i = 0; i < 12; i++) {
      voteCopy[i] = voteIterator[i];
    }

    //insertion sort copy
    for (uint i = 1; i < 12; i++)
    {
      address keyAddress = voteCopy[i];
      uint key = voteCounts[keyAddress];

      uint j = i - 1;

      bool broke = false;
      while (j >= 0 && voteCounts[voteCopy[j]] < key) {
        voteCopy[j + 1] = voteCopy[j];

        if (j == 0) {
          broke = true;
          break;
        }
        else j--;
      }

      if (broke) voteCopy[0] = keyAddress;
      else voteCopy[j + 1] = keyAddress;
    }

    for (uint i = 11; i >= 6; i--) {
      address vote = voteCopy[i];
      walletWasVotedFor[vote] = false;
    }

    delete voteIterator;
    for (uint i = 0; i < 6; i++) {
      voteIterator.push(voteCopy[i]);
    }

  }

  function _voteForAddressBy(address charityWalletVote, address sender) private {
    require(isStaked(sender));

    trackCandidate(charityWalletVote);

    removeVoteWeight(sender);
    setVoteWeight(sender);
    addVoteWeight(sender, charityWalletVote);
    updateCharityWallet();
  }

  function trackCandidate(address charityWalletCandidate) private {
    // If wallet was never voted for before add it to voteIterator
    if (!walletWasVotedFor[charityWalletCandidate]) {
      require(voteIterator.length < 12, "Vote Iterator must be rebuilt");

      voteIterator.push(charityWalletCandidate);
      walletWasVotedFor[charityWalletCandidate] = true;
    }
  }

  function removeVoteWeight(address sender) private {
    address vote = currentVotes[sender];
    voteCounts[vote] = voteCounts[vote] - voteWeights[sender];
  }

  function setVoteWeight(address sender) private {
    uint256 newVoteWeight = _balances[sender];
    voteWeights[sender] = newVoteWeight;
  }

  function addVoteWeight(address sender, address charityWalletVote) private {
    voteCounts[charityWalletVote] = voteCounts[charityWalletVote] + voteWeights[sender];
    currentVotes[sender] = charityWalletVote;
  }

  function voteForAddress(address charityWalletVote) public {
    _voteForAddressBy(charityWalletVote, _msgSender());
  }

  event NewCharityWallet(address oldW, address newW);

  function updateCharityWallet() private {
    uint256 maxVoteValue = 0; 
    address winner = address(0);

    for (uint i = 0; i < voteIterator.length; i++) {
      address currentWallet = voteIterator[i];
      uint256 voteValue = voteCounts[currentWallet];

      if (voteValue > maxVoteValue) {
        maxVoteValue = voteValue;
        winner = currentWallet;
      }
    }

    if (currentCharityWallet == winner) return;

    emit NewCharityWallet(currentCharityWallet, winner);

    currentCharityWallet = winner;
  }

  function validCharityWallet() internal returns (bool) {
    currentCharityWallet != address(0) && !isStaked(currentCharityWallet);
  }

  function getCompoundingFactor(address wallet) private view returns (uint) {
    return block.timestamp - periodStart[wallet];
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

  function getTransactionFee(uint256 txAmt) private view returns (uint256){
    uint period = block.timestamp - _contractStart;

    if (period > 31536000) return 0;
    else if (period > 23652000) return txAmt / 400;
    else if (period > 15768000) return txAmt / 200;
    else if (period > 7884000) return (txAmt / 400) * 3;
    else return txAmt / 100;
  } 

  function reifyYield(address wallet) public {
    require(isStaked(wallet), 'MstBeStkd');

    uint compoundingFactor = getCompoundingFactor(wallet);

    if (compoundingFactor < 60) return;

    uint256 yield = calculateYield(_balances[wallet], compoundingFactor);

    _balances[wallet] += yield;

    if (validCharityWallet()) {
      uint256 charityYield = (yield / 7) * 3;
      _balances[currentCharityWallet] += charityYield;
      _totalSupply += (yield + charityYield);
    } else {
      _totalSupply += yield;
    }

    periodStart[wallet] = block.timestamp;
  }

  function enoughFundsToStake(address wallet) private view returns (bool) {
    return _balances[wallet] >= 1000000000000000000000;
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

    if (isStaked(account) && currentCharityWallet != account) {
      return b + calculateYield(b, getCompoundingFactor(account));
    }
    return b;
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal virtual {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");
    require(!isStaked(sender), "StkdWlltCnntTrnsf");
    require(isUnlocked(sender), "LockedWlltCnntTrnsfr");
    require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");

    if (isStaked(recipient)) {
      reifyYield(recipient);
    }

    uint sentAmount = amount; 

    if (validCharityWallet()) {
      uint256 txFee = getTransactionFee(amount);

      if (txFee != 0) {
        sentAmount -= txFee;
        _balances[currentCharityWallet] += txFee;
      }
    }

    _balances[sender] -= amount;
    _balances[recipient] += sentAmount;

    emit Transfer(sender, recipient, amount);
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public override returns (bool) {
    _approve(_msgSender(), spender, amount);
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
