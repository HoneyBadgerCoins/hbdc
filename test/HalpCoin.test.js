// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');
 
async function initializeAccounts(accounts, accountValues) {
  await this.bank.setAuthorizedContract(this.halp.address);
  for (let i = 0; i < accountValues.length; i++) {
    console.log(accounts[i], accountValues[i]);
    await this.bank._testInitAccount(accounts[1], accountValues[i]);
  }
  await increaseTime(386401);

  for (let j = 0; j < accountValues.length; j++) {
    console.log(accounts[j]);
    await this.halp._testReq(accounts[j]);
  }
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
    this.halp = await HalpCoin.new(this.bank.address);
    await this.halp.initialize(this.bank.address);
  });

  it('should calculateYield correctly', async function () {
    const secondsInYear = 31556952;

    //const yielded = await this.halp.calculateYield(1000000000000000, secondsInYear)
    const yielded = await this.halp.calculateYield(1000000000, 1);
    expect(yielded.toString()).to.equal("1000000002");

    const yielded2 = await this.halp.calculateYield(1000000000, 2);
    expect(yielded2.toString()).to.equal("1000000004");

    const yielded3 = await this.halp.calculateYield(1000000000, 31556952);
    expect(yielded3.toString()).to.equal("1069999999");

    //TODO: test short curcuit

    //TODO: test functional limits before overflow
  });
 
  it('should initialize supply by default', async function () {
    var ts = await this.halp.totalSupply();

    assert.equal(ts.toString(), '10000000', 'total supply isn\'t right');
  });

  //TODO: break this down
  it('should be able to authenticate with the bank', async function () {
    await this.bank.setAuthorizedContract(this.halp.address);

    await this.bank._testInitAccount(accounts[0], 20000000000);

    var fundsAdded = await this.halp.requisitionFromBank();
    expect(fundsAdded.logs[0].args[1].toString()).to.equal('10000000000');

    var balanceOf = await this.halp.balanceOf(accounts[0]);
    expect(balanceOf.toString()).to.equal('10000000000');

    let eMsg;
    try {
      var f2 = await this.halp.requisitionFromBank();
    }
    catch (e) {
      eMsg = e.reason;
    }
    expect(eMsg).to.equal('0TimePassed');

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
    await initializeAccounts.call(this, accounts, [10000000000]);
  });
});
