pragma solidity ^0.7.0;

import './Ownable.sol';
import "@chainlink/contracts/src/v0.7/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.7/Chainlink.sol";

contract GrumpBank is Ownable, ChainlinkClient {
  using Chainlink for Chainlink.Request;

  mapping (address => uint256) public oldBalances;
  mapping (address => uint) requisitionTime;
  uint deployedTime;

  uint256 constant withdrawalRate = 10000000000;

  address authenticatedAddress;

  address private oracle;
  bytes32 private jobId;
  uint256 private fee;

  mapping (bytes32 => address) requestFor;

  constructor(address _link, address _oracle, bytes32 _jobId) {
    //I think this is where the fee goes
    if (_link == address(0)) {
      setPublicChainlinkToken();
    } else {
      setChainlinkToken(_link);
    }

    oracle = _oracle;
    jobId = _jobId;

    //Fee for chainlink nodes who fail the request
    fee = 0.1 * 10 ** 18;

    deployedTime = block.timestamp;
  }

  function _testInitAccount(address account, uint256 amount) public {
    oldBalances[account] = amount;
  }

  function setAuthorizedContract(address erc20) onlyOwner public returns (address) {
    authenticatedAddress = erc20;
    return erc20;
  }

  function initializeEscrowAccountFor(address onBehalfOf) public {
    require(msg.sender == authenticatedAddress, "unauthedAddr");

    Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);

    string memory fuck = "fuck";
    string memory you = "you";
        
    //req.add("get", "https://min-api.cryptocompare.com/data/pricemultifull?fsyms=ETH&tsyms=USD");

    req.add(fuck, you);
    
    //req.add("path", addressToString(onBehalfOf));
    
    bytes32 reqId = sendChainlinkRequestTo(oracle, req, fee);
    requestFor[reqId] = onBehalfOf;
  }

  function fulfill(bytes32 _requestId, uint256 originalBalance) public recordChainlinkFulfillment(_requestId)
  {
    oldBalances[requestFor[_requestId]] = originalBalance;
  }

  function addressToString(address _address) public pure returns(string memory) {
    bytes32 _bytes = bytes32(uint256(_address));
    bytes memory HEX = "0123456789abcdef";
    bytes memory _string = new bytes(42);
    _string[0] = '0';
    _string[1] = 'x';
    for(uint i = 0; i < 20; i++) {
      _string[2+i*2] = HEX[uint8(_bytes[i + 12] >> 4)];
      _string[3+i*2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
    }
    return string(_string);
  }

  function requisitionTokens(address onBehalfOf) public returns (uint256) {
    require(msg.sender == authenticatedAddress, "unauthedAddr");
    uint256 userBalance = oldBalances[onBehalfOf];

    if (userBalance <= 0) return 0;

    uint lastWithdrawal = requisitionTime[onBehalfOf];
    if (lastWithdrawal == 0) {
      lastWithdrawal = deployedTime - 86400;
    }

    uint timeSinceWithdrawal = block.timestamp - lastWithdrawal;
    require(timeSinceWithdrawal > 0, "0TimePassed");

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
