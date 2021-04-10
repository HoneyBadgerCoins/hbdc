// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');

const { expectRevert, time } = require('@openzeppelin/test-helpers')
 
async function initializeAccounts(grumpy, halp, accounts, accountValues) {
  for (let k = 0; k < accountValues.length; k++) {
    if (k != 0) {
      await grumpy.transfer(accounts[k], accountValues[k] * 2);
    }

    await grumpy._approve(accounts[k], halp.address, accountValues[k]);

    await halp._swapGrumpyTest(accounts[k], accountValues[k]);
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
 
contract('HalpCoin', accounts => {

  let grumpy, halp;

  beforeEach(async function () {
    grumpy = await Grumpy.new();
    halp = await HalpCoin.new(grumpy.address, {initializer: '__HalpCoin_init'});
    await halp.__HalpCoin_init(grumpy.address);
  });

  it('should calculateYield correctly', async function () {
    const secondsInYear = 31556952;

    //const yielded = await halp.calculateYield(1000000000000000, secondsInYear)
    const yielded = await halp.calculateYield(1000000000, 1);
    expect(yielded.toString()).to.equal("2");

    const yielded2 = await halp.calculateYield(1000000000, 2);
    expect(yielded2.toString()).to.equal("4");

    const yielded3 = await halp.calculateYield(1000000000, 31556952);
    expect(yielded3.toString()).to.equal("69999999");
    //TODO: test short curcuit

    //TODO: test functional limits before overflow
  });
 
  it('should initialize supply by default', async function () {
    var ts = await halp.totalSupply();

    assert.equal(ts.toString(), '0', 'total supply isn\'t right');
  });

  it('should stake correctly', async function () {
    await initializeAccounts(grumpy, halp, accounts, [1000000000]);

    expect(await getErrorMsg(() => halp.reifyYield(accounts[0]))).to.equal('MstBeStkd');

    await halp.stakeWallet();

    //await halp.reifyYield(accounts[0]);

    await halp.voteForAddress(accounts[4]);

    await increaseTime(31556952);

    await halp.unstakeWallet();

    let charityWallet = await halp.balanceOf(accounts[4]);
    expect(charityWallet.toString()).to.satisfy(s =>
      s >= '69999998' && s <= '70000002'
    );
  });

  it('should not allow small users to stake', async function () {
    await initializeAccounts(grumpy, halp, accounts, [1000, 100000000000]);

    const a = await halp.balanceOf(accounts[0]);
    const b = await halp.balanceOf(accounts[1]);

    expect(await getErrorMsg(() => halp.stakeWallet())).to.equal('InsfcntFnds');
  });

  it('should accurately calculate yield with intermediate reifications', async function () {
    await initializeAccounts(grumpy, halp, accounts, [1000000000]);
    await halp.stakeWallet();
    await increaseTime(10000000);
    await halp.reifyYield(accounts[0]);
    await increaseTime(10000000);
    await halp.reifyYield(accounts[0]);
    await increaseTime(11556952);
    await halp.unstakeWallet();

    let bal = await halp.balanceOf(accounts[0]);
    expect(bal.toString()).to.satisfy(b =>
      b >= '1069999999' && b <= "1070000008"
    );
  });

  it('should apply and unapply user votes correctly', async function () {
    await initializeAccounts(grumpy, halp, accounts, [1000000000, 2000000000, 1500000000]);
    await halp._stakeWalletFor(accounts[0]);
    await halp._stakeWalletFor(accounts[1]);
    await halp._stakeWalletFor(accounts[2]);

    await halp.voteForAddress(accounts[6]);

    expect(await halp.getCharityWallet()).to.equal(accounts[6]);

    await halp._voteForAddressBy(accounts[5], accounts[1]);

    expect(await halp.getCharityWallet()).to.equal(accounts[5]);

    await halp._voteForAddressBy(accounts[6], accounts[2]);

    expect(await halp.getCharityWallet()).to.equal(accounts[6]);
    
    await halp.voteForAddress(address0);

    expect(await halp.getCharityWallet()).to.equal(accounts[5]);

    await increaseTime(31556952000);

    await halp.reifyYield(accounts[2]);

    await halp._voteForAddressBy(accounts[6], accounts[2]);

    expect(await halp.getCharityWallet()).to.equal(accounts[6]);

    //TODO: test precise balances and also test when an account receives funds while staked and voted
  });
  //TODO: should allow a user to update their vote weight by revoting for the same address
  it('should not allow staked wallets to send or receive funds', async function() {
    await initializeAccounts(grumpy, halp, accounts, [10000]);
    await halp.approve(accounts[0], 100);
    await halp.stakeWallet();
    expect(await getErrorMsg(() => halp.transferFrom(accounts[0], accounts[1], 100))).to.equal("Staked wallets should not be able to transfer tokens");
  });


  //TODO: should allow a user to send funds to a staked wallet using sendFundsToStakedWallet
  it("Allows a user to send funds to a staked wallet using sendFundsToStakeWallet", async function (){
    await initializeAccounts(grumpy, halp, accounts, [10000, 1000]);
    await halp.approve(accounts[0], 500);
    await halp._stakeWalletFor(accounts[1]);
    await halp.sendFundsToStakedWallet(accounts[0], accounts[1], 500);

    let transfer = await halp.balanceOf(accounts[1]);
    expect( transfer.toString()).to.equal("1500");
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
