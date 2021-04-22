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

          await expectRevert(fuelTank.reclaimGrumpies(), 'BalanceEmpty');
        });
      });
    });
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

    assert.equal(ts.toString(), '0', 'total supply isn\'t right');
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
    expect(charityWallet.toString()).to.satisfy(priceRange('299999980000000', '300000030000000'));
  });

  context('TX fee', async function () {
    context('CharityWallet unset', async function () {
      beforeEach(async function () {
        await initializeAccounts(grumpy, meow, accounts, [10000000, 10000]);
      });
      it('should take out the 0% at t = 0', async function () {
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('0')
        expect(b2.toString()).to.equal('10000000')
      });
    });
    context('CharityWallet set', async function () {
      beforeEach(async function () {
        await initializeAccounts(grumpy, meow, accounts, [10000000, 10000, B('10000000000000000')]);
        await meow._stakeWalletFor(accounts[2]);
        await meow._voteForAddressBy(accounts[3], accounts[2]);
      });
      it('should allow the user to send small amounts early on', async function () {
        await meow.transfer(accounts[1], 10);

        var b1 = await meow.balanceOf(accounts[0]);
        var b2 = await meow.balanceOf(accounts[1]);

        expect(b1.toString()).to.equal('9999990')
        expect(b2.toString()).to.equal('10010')
      });

      it('should take out the 1% at t = 0', async function () {
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('100000')
        expect(b2.toString()).to.equal('9900000')
      });
      it('should take out the 0.75% at t = 5 months', async function () {
        await time.increase(12960000);
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('75000')
        expect(b2.toString()).to.equal('9925000')
      });
      it('should take out the 0.5% at t = 8 months', async function () {
        await time.increase(20736000);
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('50000')
        expect(b2.toString()).to.equal('9950000')
      });
      it('should take out the 0.25% at t = 10 months', async function () {
        await time.increase(25920000);
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('25000')
        expect(b2.toString()).to.equal('9975000')
      });
      it('should take out the 0% at t > 12 months', async function () {
        await time.increase(31537000);
        await meow.transfer(accounts[4], 10000000);

        var b1 = await meow.balanceOf(accounts[3]);
        var b2 = await meow.balanceOf(accounts[4]);

        expect((await meow.balanceOf(accounts[0])).toString()).to.equal('0')
        expect(b1.toString()).to.equal('0')
        expect(b2.toString()).to.equal('10000000')
      });
    });
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

    expect(await meow.currentCharityWallet()).to.equal(accounts[6]);

    await meow._voteForAddressBy(accounts[5], accounts[1]);

    expect(await meow.currentCharityWallet()).to.equal(accounts[5]);

    await meow._voteForAddressBy(accounts[6], accounts[2]);

    expect(await meow.currentCharityWallet()).to.equal(accounts[6]);
    
    await meow.voteForAddress(address0);

    expect(await meow.currentCharityWallet()).to.equal(accounts[5]);

    await increaseTime(31556952000);

    await meow.reifyYield(accounts[2]);

    await meow._voteForAddressBy(accounts[6], accounts[2]);

    expect(await meow.currentCharityWallet()).to.equal(accounts[6]);
  });

  it('should handle address0 in votes correctly', async function () {
    await initializeAccounts(grumpy, meow, accounts,
      [B('10000000000000000'),
       B('20000000000000000'),
       B('15000000000000000')]);
    await meow._stakeWalletFor(accounts[0]);
    await meow._stakeWalletFor(accounts[1]);
    await meow._stakeWalletFor(accounts[2]);

    await meow.voteForAddress(accounts[6]);
    await meow._voteForAddressBy(accounts[5], accounts[1]);
    await meow.voteForAddress(address0);
    await meow._voteForAddressBy(address0, accounts[2]);

    await increaseTime(31556952);

    await meow.reifyYield(accounts[0]);
    await meow.reifyYield(accounts[1]);
    await meow.reifyYield(accounts[2]);

    await meow.unstakeWallet();

    await increaseTime(31556952);

    await meow.reifyYield(accounts[2]);

    await meow._unstakeWalletFor(accounts[1], true);
    await meow._unstakeWalletFor(accounts[2], true);

    await increaseTime(31556952);

    await meow.transfer(accounts[2], 2012);

    const results = await Promise.all([
      meow.voteIterator([0]),
      meow.voteIterator([1]),
      meow.voteIterator([2]),
      meow.voteWeights(address0),
      meow.voteWeights(accounts[6]),
      meow.voteWeights(accounts[5]),
    ]);

    expect(results[4].toString()).to.equal('0');
    expect(results[5].toString()).to.equal('0');
  });

  context('VoteIterator', async function () {
    const balDiffs = [
      '5', //0
      '2', //1
      '3', //2
      '2', //3
      '5', //4
      '4', //5
      '13', //6
      '2', //7
      '2', //8
      '1', //9
      '1', //10
      '2', //11
      '1', //12
      '7', //13
      '1', //14
    ];

    beforeEach(async function () {
      await initializeAccounts(grumpy, meow, accounts, balDiffs.map(s => B(s + '0000000000000000')));
    });
    beforeEach(async function () {
      for (let i = 0; i < balDiffs.length; i++) {
        await meow._stakeWalletFor(accounts[i]);
      }
    });
    context('12 different addresses voted for', async function () {
      beforeEach(async function () {
        for (let i = 0; i < 12; i++) {
          await meow._voteForAddressBy(accounts[i], accounts[i]);
        };
        await meow._voteForAddressBy(accounts[0], accounts[13]);
      });
      it('should not allow another vote in without a rebuild', async function () {
        await expectRevert(meow._voteForAddressBy(accounts[14], accounts[14]), "Vote Iterator must be rebuilt");
      });
      context('Iterator is rebuilt', async function () {
        beforeEach(async function () {
          await meow.rebuildVotingIterator();
        });
        it('should have the right length', async function () {
          const itLength = await meow.voteIteratorLength();
          expect(itLength.toString()).to.equal('6');
        });
        it('should have sorted them by vote strength', async function () {
          const first = await meow.voteIterator(0);
          expect(first).to.equal(accounts[6]);
          const second = await meow.voteIterator(1);
          expect(second).to.equal(accounts[0]);
        });
        it('should allow a cut off candidate have their current weight handled correctly as an iterated candidate if it is revoted for', async function () {
          await meow._voteForAddressBy(accounts[9], accounts[6]);

          const weight = await meow.voteCounts(accounts[9]);
          const candidate = await meow.voteIterator(6);
          expect(weight.toString()).to.equal('140000000000000000')
          expect(candidate).to.equal(accounts[9]);
        });
      });
    });
  });
  context('VoteIterator stress test', async function () {
    const balDiffs = [
      '1', //0
      '2', //1
      '3', //2
      '4', //3
      '5', //4
      '6', //5
      '7', //6
      '8', //7
      '9', //8
      '10', //9
      '11', //10
      '12', //11
    ];

    beforeEach(async function () {
      await initializeAccounts(grumpy, meow, accounts, balDiffs.map(s => B(s + '0000000000000000')));
      for (let i = 0; i < 12; i++) {
        await meow._stakeWalletFor(accounts[i]);
      }
      for (let i = 0; i < 12; i++) {
        await meow._voteForAddressBy(accounts[i], accounts[i]);
      };
    });
    
    it('should not reach the gas limit by sorting the worse case list', async function () {
      const tx = await meow.rebuildVotingIterator();
    });
  })

  //TODO: should allow a user to update their vote weight by revoting for the same address
  it('should not allow staked wallets to send or receive funds', async function() {
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000')]);
    await meow.approve(accounts[0], 10000000);
    await meow.stakeWallet();
    expect(await getErrorMsg(() => meow.transferFrom(accounts[0], accounts[1], 10000000))).to.equal("StkdWlltCnntTrnsf");
  });

  it("should only allow a user to send funds to a staked wallet using transferToStakedWallet", async function (){
    await initializeAccounts(grumpy, meow, accounts, [B('10000000000000000'), B('10000000000000000')]);

    await meow._stakeWalletFor(accounts[1]);
    await meow.transferToStakedWallet(accounts[1], 50000000000);

    let transfer = await meow.balanceOf(accounts[1]);
    expect(transfer.toString()).to.equal("10000050000000000");

    await expectRevert(meow.transfer(accounts[1], '123132123'), 'RecipientStaked')

    await meow.approve(accounts[0], '10000000');
    await expectRevert(meow.transferFrom(accounts[0], accounts[1], '123132123'), 'RecipientStaked')
  });

  it("locking should work", async function (){
    await initializeAccounts(grumpy, meow, accounts, [B('20000000000000000'), B('10000000000000000')]);
    await meow.stakeWallet();
    await meow.unstakeWallet();
    await expectRevert(meow.transfer(accounts[1], 20000), "LockedWlltCnntTrnsfr");
    await expectRevert(meow.stakeWallet(), "WalletIsLocked");
    await time.increase(86400 * 6);
    await meow.transfer(accounts[1], 20000)
    await meow.stakeWallet()
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
            const w = await meow.currentCharityWallet();
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
            const w = await meow.currentCharityWallet();
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
            expect(b.toString()).to.satisfy(priceRange('11000000000000000', '11100900000000000'));
          });
        });
      });
    });

  });
});
