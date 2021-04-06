// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');

const { oracle } = require('@chainlink/test-helpers')
const { expectRevert, time } = require('@openzeppelin/test-helpers')

const { LinkToken } = require('@chainlink/contracts/truffle/v0.4/LinkToken')
const { Oracle } = require('@chainlink/contracts/truffle/v0.6/Oracle')

 
async function initializeAccounts(accounts, accountValues) {
  await this.bank.setAuthorizedContract(this.halp.address);
  for (let i = 0; i < accountValues.length; i++) {
    await this.bank._testInitAccount(accounts[i], accountValues[i]);
  }
  await increaseTime(386401);

  for (let j = 0; j < accountValues.length; j++) {
    await this.halp._requisitionFromBankFor(accounts[j]);
  }
}

async function getErrorMsg(f) {
  let received;
  try { await f(); }
  catch (e) {
    received = e.reason;
  }
  return received;
}

// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');

const address0 = '0x0000000000000000000000000000000000000000';

const increaseTime = function(duration) {
  const id = Date.now()

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1)

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id+1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res)
      })
    })
  })
}
 
contract('HalpCoin', accounts => {

  const jobId = web3.utils.toHex('4c7b7ffb66b344fbaa64995af81e355a')
  const url =
    'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,EUR,JPY'

  const defaultAccount = accounts[0]
  const oracleNode = accounts[1]

  let link, oc;

  beforeEach(async function () {
    link = await LinkToken.new({ from: defaultAccount })
    oc = await Oracle.new(link.address, { from: defaultAccount })

    this.bank = await GrumpBank.new(link.address, oc.address, jobId);
    this.halp = await HalpCoin.new(this.bank.address, {initializer: '__HalpCoin_init'});
    await this.halp.__HalpCoin_init(this.bank.address);

    await oc.setFulfillmentPermission(oracleNode, true, {
      from: defaultAccount,
    })
  });

  it('should calculateYield correctly', async function () {
    const secondsInYear = 31556952;

    //const yielded = await this.halp.calculateYield(1000000000000000, secondsInYear)
    const yielded = await this.halp.calculateYield(1000000000, 1);
    expect(yielded.toString()).to.equal("2");

    const yielded2 = await this.halp.calculateYield(1000000000, 2);
    expect(yielded2.toString()).to.equal("4");

    const yielded3 = await this.halp.calculateYield(1000000000, 31556952);
    expect(yielded3.toString()).to.equal("69999999");
    //TODO: test short curcuit

    //TODO: test functional limits before overflow
  });
 
  it('should initialize supply by default', async function () {
    var ts = await this.halp.totalSupply();

    assert.equal(ts.toString(), '0', 'total supply isn\'t right');
  });

  //TODO: break this down
  it('should be able to authenticate with the bank', async function () {
    await this.bank.setAuthorizedContract(this.halp.address);
    await this.bank._testInitAccount(accounts[0], 20000000000);

    var fundsAdded = await this.halp.requisitionFromBank();
    expect(fundsAdded.logs[0].args[1].toString()).to.equal('10000000000');

    var balanceOf = await this.halp.balanceOf(accounts[0]);
    expect(balanceOf.toString()).to.equal('10000000000');

    await increaseTime(1);

    var f3 = await this.halp.requisitionFromBank();
    expect(f3.logs[0].args[1].toString()).to.equal('0');

    await increaseTime(86401);

    var f3 = await this.halp.requisitionFromBank();
    expect(f3.logs[0].args[1].toString()).to.equal('10000000000');

    var b2 = await this.halp.balanceOf(accounts[0]);
    expect(b2.toString()).to.equal('20000000000');
  });

  it('should stake correctly', async function () {
    await initializeAccounts.call(this, accounts, [1000000000]);

    expect(await getErrorMsg(() => this.halp.reifyYield(accounts[0]))).to.equal('MstBeStkd');

    await this.halp.stakeWallet();

    //await this.halp.reifyYield(accounts[0]);

    await this.halp.voteForAddress(accounts[4]);

    await increaseTime(31556952);

    await this.halp.unstakeWallet();

    let charityWallet = await this.halp.balanceOf(accounts[4]);
    expect(charityWallet.toString()).to.satisfy(s =>
      s >= '69999998' && s <= '70000002'
    );
  });

  it('should not allow small users to stake', async function () {
    await initializeAccounts.call(this, accounts, [1000, 100000000000]);

    expect(await getErrorMsg(() => this.halp.stakeWallet())).to.equal('InsfcntFnds');
  });

  it('should accurately calculate yield with intermediate reifications', async function () {
    await initializeAccounts.call(this, accounts, [1000000000]);
    await this.halp.stakeWallet();
    await increaseTime(10000000);
    await this.halp.reifyYield(accounts[0]);
    await increaseTime(10000000);
    await this.halp.reifyYield(accounts[0]);
    await increaseTime(11556952);
    await this.halp.unstakeWallet();

    let bal = await this.halp.balanceOf(accounts[0]);
    expect(bal.toString()).to.satisfy(b =>
      b >= '1069999999' && b <= "1070000008"
    );
  });

  it('should apply and unapply user votes correctly', async function () {
    await initializeAccounts.call(this, accounts, [1000000000, 2000000000, 1500000000]);
    await this.halp._stakeWalletFor(accounts[0]);
    await this.halp._stakeWalletFor(accounts[1]);
    await this.halp._stakeWalletFor(accounts[2]);

    await this.halp.voteForAddress(accounts[6]);

    expect(await this.halp.getCharityWallet()).to.equal(accounts[6]);

    await this.halp._voteForAddressBy(accounts[5], accounts[1]);

    expect(await this.halp.getCharityWallet()).to.equal(accounts[5]);

    await this.halp._voteForAddressBy(accounts[6], accounts[2]);

    expect(await this.halp.getCharityWallet()).to.equal(accounts[6]);
    
    await this.halp.voteForAddress(address0);

    expect(await this.halp.getCharityWallet()).to.equal(accounts[5]);

    await increaseTime(31556952000);

    await this.halp.reifyYield(accounts[2]);

    await this.halp._voteForAddressBy(accounts[6], accounts[2]);

    expect(await this.halp.getCharityWallet()).to.equal(accounts[6]);

    //TODO: test precise balances and also test when an account receives funds while staked and voted
  });
  //TODO: should allow a user to update their vote weight by revoting for the same address
  it('should not allow staked wallets to send or receive funds', async function() {
    await initializeAccounts.call(this, accounts, [10000, 0]);
    await this.halp.approve(accounts[0], 100);
    await this.halp.stakeWallet();
    expect(await getErrorMsg(() => this.halp.transferFrom(accounts[0], accounts[1], 100))).to.equal("Staked wallets should not be able to transfer tokens");
  });
  //TODO: should apply and unapply a users vote weight correctly,
  //        and determine the charity wallet accurately with any sequence
  //TODO: somehow have tests that verify funds go to the right place (??? vague)
  //TODO: handle pausing staked rewards correctly
  //        if a staked wallet ever becomes the charity wallet, it should instantly reify, and then begin its yield term
  //          when it is no longer the charity waller
  //        it should also work correctly if it stops staking before being unselected as the charity wallet
  //TODO: should allow a user to unstake without reification using a separate function
  //TODO: handle account(0) as the charity wallet safely
  //        voting
  //        reification
  //        transaction
  //TODO: it should take a portion of each transaction for the charity wallet
  //TODO: should allow a user to send funds to a staked wallet using sendFundsToStakedWallet
  //TODO: should allow a user to requisitionFromBank into a staked wallet but should reify first
  //TODO: ensure the locking mechanism works for unstaking
  //TODO: figure out problem with getting nft value if a staked wallet receives funds

  //TODO: think about failure modes regarding the banking process
  //        initial filling
  //        sealing initial deposits
  //        preventing new contracts from being authorized
  //        ...?
});
