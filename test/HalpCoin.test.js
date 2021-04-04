// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');
 
async function initializeAccounts(accounts, accountValues) {
  await this.bank.setAuthorizedContract(this.halp.address);
  for (let i = 0; i < accountValues.length; i++) {
    await this.bank._testInitAccount(accounts[i], accountValues[i]);
  }
  await increaseTime(386401);

  for (let j = 0; j < accountValues.length; j++) {
    await this.halp._testReq(accounts[j]);
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
  beforeEach(async function () {
    this.bank = await GrumpBank.new();
    this.halp = await HalpCoin.new(this.bank.address, {initializer: '__HalpCoin_init'});
    await this.halp.initialize(this.bank.address);
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
      s == "69999998" || s == "70000002"
    );
  });

  it('should not allow small users to stake', async function () {
    await initializeAccounts.call(this, accounts, [1000, 100000000000]);

    expect(await getErrorMsg(() => this.halp.stakeWallet())).to.equal('InsfcntFnds');
  });

  //TODO: should accurately calculate yield with intermediate reifications
  //TODO: should apply and unapply a users vote weight correctly, and determine the charity wallet accurately with any sequence
  //TODO: not allow staked wallets to send or receive funds
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
});
