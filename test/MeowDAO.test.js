// test/MeoDAO.test.js
// Load dependencies
const { expect } = require('chai');

const { expectRevert, time } = require('@openzeppelin/test-helpers')
 
async function initializeAccounts(grumpy, meow, accounts, accountValues) {

  for (let k = 0; k < accountValues.length; k++) {
    if (k != 0) {
      await grumpy.transfer(accounts[k], accountValues[k]);
      await grumpy.transfer(accounts[k], accountValues[k]);
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

function priceRange(a, b) {
  return s => s.length == a.length && s >= a && s <= b;
}

function B(string) {
  return web3.utils.toBN(string);
}

// Load compiled artifacts
const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');
const FuelTank = artifacts.require('GrumpyFuelTank');

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
 

contract('MeowDAO', accounts => {

  let grumpy, fuelTank, meow;

  beforeEach(async function () {
    grumpy = await Grumpy.new();
    fuelTank = await FuelTank.new(grumpy.address);

    meow = await MeowDAO.new(grumpy.address, fuelTank.address);

    await fuelTank.addMeowDAOaddress(meow.address);
  });

  it('should totalStartingSupply should be 10^23', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000, 2000000000]);

    const totalsSupply = await meow.totalStartingSupply();
    expect(totalsSupply.toString()).to.equal("100000000000000000000000");
  });

  it('should initializeCoinThruster correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000, 2000000000]);
    await meow._testAdvanceEndTime();
    await meow.initializeCoinThruster();
  });

  context('FuelTank', async function() {
    beforeEach(async function () {
      await initializeAccounts(grumpy, meow, accounts, [1000000000, 2000000000]);
    });
    it('should not allow users to reclaim during phase 1', async function () {
      await expectRevert(fuelTank.reclaimGrumpies(), "Phase1");
    });
    context('Phase 2', async function () {
      beforeEach(async function () {
        await time.increase(86400 * 6);
        await meow.initializeCoinThruster();
      });
      it('should not allow users to reclaim during phase 2', async function () {
        await expectRevert(fuelTank.reclaimGrumpies(), "Phase2");
      });
      context('Phase 3', async function () {
        beforeEach(async function () {
          await time.increase(86400 * 3);
        });
        it('should allow users to reclaim during phase 3', async function () {
          const b = await grumpy.balanceOf(accounts[0]);
          await fuelTank.reclaimGrumpies();
          const b2 = await grumpy.balanceOf(accounts[0]);

          expect(b2.sub(b).toString()).to.equal('720000000');

          expectRevert(fuelTank.reclaimGrumpies(), 'BalanceEmpty');
        });
      });
    });
  });

  it("Dev wallet should not be claimable for one year", async function() {
    await expectRevert(meow.retrieveDevFunds(), "Vesting period pending");
    await time.increase(86400 * 366);
    await meow.retrieveDevFunds();

    const devWallet = await meow.devWallet();
    const devBalance = await meow.balanceOf(devWallet);
    expect(devBalance.toString()).to.equal('2500000000000000000000');

    await expectRevert(meow.retrieveDevFunds(), "DevFundsClaimed");
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
  });
 
  it('should initialize supply by default', async function () {
    var ts = await meow.totalSupply();

    assert.equal(ts.toString(), '2500000000000000000000', 'total supply isn\'t right');
  });

  it('should initializeAccounts correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts, [1000000000, 2000000000]);

    const b1 = await meow.balanceOf(accounts[0]);
    const b2 = await meow.balanceOf(accounts[1]);

    expect(b1.toString()).to.equal('1000000000');
    expect(b2.toString()).to.equal('2000000000');
  });

  it('should stake correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000')]);

    expect(await getErrorMsg(() => meow.reifyYield(accounts[0]))).to.equal('MstBeStkd');

    await meow.stakeWallet();

    //await meow.reifyYield(accounts[0]);

    await meow.voteForAddress(accounts[4]);

    await increaseTime(31556952);

    await meow.unstakeWallet();

    let charityWallet = await meow.balanceOf(accounts[4]);
    expect(charityWallet.toString()).to.satisfy(priceRange('699999980000000', '700000030000000'));
  });

  it('Tx fee should be 1000 after 2months for 100000', async function () {
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);
    const month2= 5184000 
    await increaseTime(month2);
    expect((await meow.getTransactionFee(100000)).toString()).to.equal('1000');
  });

  it('Tx fee should be 750 after 5 months for 100000', async function () {
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);
    const month5 = 12960000;
    await increaseTime(month5);
    expect((await meow.getTransactionFee(100000)).toString()).to.equal('750'); 
  });

  it('Tx fee should be 500 after 8 months for 100000', async function () {
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);
    const month8 = 20736000;
    await increaseTime(month8);
    expect((await meow.getTransactionFee(100000)).toString()).to.equal('500');
  });

  it('Tx fee should be 250 after 10 month for 100000', async function () {
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);
    const month10 = 25920000;
    await increaseTime(month10);
    expect((await meow.getTransactionFee(100000)).toString()).to.equal('250');
  });

  it('Tx fee should be 0 after 12 month for 100000', async function () {
    await initializeAccounts(grumpy, meow, accounts, [10000, 1000]);
    const aftermonth12 = 31537000;
    await increaseTime(aftermonth12);
    expect((await meow.getTransactionFee(100000)).toString()).to.equal('0');
  });

  it('should not allow small users to stake', async function () {

    await initializeAccounts(grumpy, meow, accounts, [1000, 100000000000]);

    const a = await meow.balanceOf(accounts[0]);
    const b = await meow.balanceOf(accounts[1]);

    expect(await getErrorMsg(() => meow.stakeWallet())).to.equal('InsfcntFnds');
  });

  it('should accurately calculate yield with intermediate reifications', async function () {
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000')]);
    await meow.stakeWallet();
    await increaseTime(10000000);
    await meow.reifyYield(accounts[0]);
    await increaseTime(10000000);
    await meow.reifyYield(accounts[0]);
    await increaseTime(11556952);
    await meow.unstakeWallet();

    let bal = await meow.balanceOf(accounts[0]);
    expect(bal.toString()).to.satisfy(priceRange('10699999990000000', "10700000080000000"));
  });

  it('should apply and unapply user votes correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts,
      [B('10000000000000000'), B('20000000000000000'), B('15000000000000000')]);
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
  });

  //TODO: should allow a user to update their vote weight by revoting for the same address
  it('should not allow staked wallets to send or receive funds', async function() {
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000')]);
    await meow.approve(accounts[0], 10000000);
    await meow.stakeWallet();
    expect(await getErrorMsg(() => meow.transferFrom(accounts[0], accounts[1], 10000000))).to.equal("StkdWlltCnntTrnsf");
  });

  it("Allows a user to send funds to a staked wallet using sendFundsToStakeWallet", async function (){
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000'), B('10000000000000000')]);

    await meow._stakeWalletFor(accounts[1]);
    await meow.sendFundsToStakedWallet(accounts[1], 50000000000);

    let transfer = await meow.balanceOf(accounts[1]);
    expect(transfer.toString()).to.equal("10000050000000000");
  });

  //TODO: ensure the locking mechanism works for unstaking
  it("locking should work with unstaking", async function (){
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000'), B('10000000000000000')]);
    await meow._stakeWalletFor(accounts[1]);
    await meow._unstakeWalletFor(accounts[1], true);
    let val = await meow.currentlyLocked(accounts[1]);    
    expect(val.toString()).to.equal("true");
  });

  context('Pausing Staking', async function () {
    beforeEach(async function() {
      await initializeAccounts(grumpy, meow, accounts,
        [B('10000000000000000'), B('10000000000000000'), B('10000000000000000')]);
      await meow._stakeWalletFor(accounts[0]);
      await meow._stakeWalletFor(accounts[1]);
      await meow._stakeWalletFor(accounts[2]);
      await increaseTime(31556952);
    });

    context("staked wallet becomes charityWallet by other vote and it unstakes after a year", async function () {
      beforeEach(async function() {
        await meow._voteForAddressBy(accounts[0], accounts[1]);
        await increaseTime(31556952);
        await meow.unstakeWallet();
      });
      it('should not get any more yield', async function () {
        await meow.reifyYield(accounts[0]);
        const b = await meow.balanceOf(accounts[0]);
        expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
      });
    });

    context("staked wallet becomes charityWallet by own vote", async function () {
      beforeEach(async function() {
        await meow._voteForAddressBy(accounts[0], accounts[0]);
      });

      it("should reify the staked wallet which has been voted upon", async function () {
        const b = await meow.balanceOf(accounts[0]);
        expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
      });

      context("1 year passes after staked wallet becomes charity wallet", function () {
        beforeEach(async function() {
          await increaseTime(31556952);
        });
        it('should not get any more yield after becoming charity wallet', async function () {
          await meow.reifyYield(accounts[0]);
          const b = await meow.balanceOf(accounts[0]);
          expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
        });
        context("it loses the vote", function () {
          beforeEach(async function() {
            await meow._voteForAddressBy(address0, accounts[0]);
          });
          it('should not get any more yield', async function () {
            await meow.reifyYield(accounts[0]);
            const b = await meow.balanceOf(accounts[0]);
            expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
          });
          it('should reset currentCharityWallet to address0', async function () {
            const w = await meow.getCharityWallet();
            expect(w).to.equal(address0);
          });
        });
        context("it unstakes", function () {
          beforeEach(async function() {
            await meow.unstakeWallet();
          });
          it('should not get any more yield', async function () {
            const b = await meow.balanceOf(accounts[0]);
            expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
          });
          it('should reset currentCharityWallet to address0', async function () {
            const w = await meow.getCharityWallet();
            expect(w).to.equal(address0);
          });
        });
      });

      context('staked charityWallet receives more votes', async function () {
        beforeEach(async function() {
          await meow._voteForAddressBy(accounts[0], accounts[1]);
          await meow._voteForAddressBy(accounts[0], accounts[2]);
        });

        it("should not have any effect", async function () {
          const b = await meow.balanceOf(accounts[0]);
          expect(b.toString()).to.satisfy(priceRange('10699800000000000', '10700900000000000'));
        });

        context('staked charityWallet loses the vote', async function () {
          beforeEach(async function() {
            await meow._voteForAddressBy(accounts[1], accounts[0]);
            await meow._voteForAddressBy(accounts[1], accounts[2]);
          });

          it("should receives the yield from the deciding vote", async function () {
            const b = await meow.balanceOf(accounts[0]);
            expect(b.toString()).to.satisfy(priceRange('11399800000000000', '11400900000000000'));
          });
        });
      });
    });

  });

  //TODO: handle account(0) as the charity wallet safely
  //        voting
  //        reification
  //        transaction
});
