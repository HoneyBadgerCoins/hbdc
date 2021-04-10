// test/MeoDAO.test.js
// Load dependencies
const { expect } = require('chai');

const { expectRevert, time } = require('@openzeppelin/test-helpers')
 
async function initializeAccounts(grumpy, meow, accounts, accountValues) {
  for (let k = 0; k < accountValues.length; k++) {
    if (k != 0) {
      await grumpy.transfer(accounts[k], accountValues[k] * 2);
    }

    await grumpy._approve(accounts[k], meow.address, accountValues[k]);

    await meow._swapGrumpyTest(accounts[k], accountValues[k]);
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
const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');

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
 

contract('MewoDAO', accounts => {

  let grumpy, meow;

  beforeEach(async function () {
    grumpy = await Grumpy.new();
    meow = await MeowDAO.new(grumpy.address, {initializer: '__MeowDAO_init'});
    await meow.__MeowDAO_init(grumpy.address);
  });

  it('should calculateYield correctly', async function () {
    const secondsInYear = 31556952;

    //const yielded = await meow.calculateYield(1000000000000000, secondsInYear)
    const yielded = await meow.calculateYield(1000000000, 1);
    expect(yielded.toString()).to.equal("2");

    const yielded2 = await meow.calculateYield(1000000000, 2);
    expect(yielded2.toString()).to.equal("4");

    const yielded3 = await meow.calculateYield(1000000000, 31556952);
    expect(yielded3.toString()).to.equal("69999999");
    //TODO: test short curcuit

    //TODO: test functional limits before overflow
  });
 
  it('should initialize supply by default', async function () {
    var ts = await meow.totalSupply();

    assert.equal(ts.toString(), '0', 'total supply isn\'t right');
  });

  it('should stake correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000]);

    expect(await getErrorMsg(() => meow.reifyYield(accounts[0]))).to.equal('MstBeStkd');

    await meow.stakeWallet();

    //await meow.reifyYield(accounts[0]);

    await meow.voteForAddress(accounts[4]);

    await increaseTime(31556952);

    await meow.unstakeWallet();

    let charityWallet = await meow.balanceOf(accounts[4]);
    expect(charityWallet.toString()).to.satisfy(s =>
      s >= '69999998' && s <= '70000002'
    );
  });

  it('should not allow small users to stake', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000, 100000000000]);

    const a = await meow.balanceOf(accounts[0]);
    const b = await meow.balanceOf(accounts[1]);

    expect(await getErrorMsg(() => meow.stakeWallet())).to.equal('InsfcntFnds');
  });

  it('should accurately calculate yield with intermediate reifications', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000]);
    await meow.stakeWallet();
    await increaseTime(10000000);
    await meow.reifyYield(accounts[0]);
    await increaseTime(10000000);
    await meow.reifyYield(accounts[0]);
    await increaseTime(11556952);
    await meow.unstakeWallet();

    let bal = await meow.balanceOf(accounts[0]);
    expect(bal.toString()).to.satisfy(b =>
      b >= '1069999999' && b <= "1070000008"
    );
  });

  it('should apply and unapply user votes correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000, 2000000000, 1500000000]);
    await meow._stakeWalletFor(accounts[0]);
    await meow._stakeWalletFor(accounts[1]);
    await meow._stakeWalletFor(accounts[2]);

    await meow.voteForAddress(accounts[6]);

    expect(await meow.getCharityWallet()).to.equal(accounts[6]);

    await meow._voteForAddressBy(accounts[5], accounts[1]);

    expect(await meow.getCharityWallet()).to.equal(accounts[5]);

    await meow._voteForAddressBy(accounts[6], accounts[2]);

    expect(await meow.getCharityWallet()).to.equal(accounts[6]);
    
    await meow.voteForAddress(address0);

    expect(await meow.getCharityWallet()).to.equal(accounts[5]);

    await increaseTime(31556952000);

    await meow.reifyYield(accounts[2]);

    await meow._voteForAddressBy(accounts[6], accounts[2]);

    expect(await meow.getCharityWallet()).to.equal(accounts[6]);

    //TODO: test precise balances and also test when an account receives funds while staked and voted
  });

  //TODO: should allow a user to update their vote weight by revoting for the same address
  it('should not allow staked wallets to send or receive funds', async function() {
    await initializeAccounts(grumpy, meow, accounts, [10000]);
    await meow.approve(accounts[0], 100);
    await meow.stakeWallet();
    expect(await getErrorMsg(() => meow.transferFrom(accounts[0], accounts[1], 100))).to.equal("StkdWlltCnntTrnsf");
  });

  //TODO: should allow a user to send funds to a staked wallet using sendFundsToStakedWallet
  it("Allows a user to send funds to a staked wallet using sendFundsToStakeWallet", async function (){
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);

    await meow._stakeWalletFor(accounts[1]);
    await meow.sendFundsToStakedWallet(accounts[1], 500);

    let transfer = await meow.balanceOf(accounts[1]);
    expect(transfer.toString()).to.equal("1500");
  });

  //TODO: handle pausing staked rewards correctly
  //        if a staked wallet ever becomes the charity wallet, it should instantly reify, and then begin its yield term
  //          when it is no longer the charity waller
  //        it should also work correctly if it stops staking before being unselected as the charity wallet
  //TODO: handle account(0) as the charity wallet safely
  //        voting
  //        reification
  //        transaction
  //TODO: should allow a user to send funds to a staked wallet using sendFundsToStakedWallet
  //TODO: ensure the locking mechanism works for unstaking
  //TODO: figure out problem with getting nft value if a staked wallet receives funds
});
