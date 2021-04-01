// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');
 
// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
contract('HalpCoin', accounts => {
  beforeEach(async function () {
    this.grumpBank = await GrumpBank.new();
    this.halp = await HalpCoin.new(this.grumpBank.address);
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
 
  it('should initialize supply by default', async () =>
    HalpCoin.deployed()
      .then(i => i.totalSupply())
      .then(supply => assert.equal(supply.toString(), '10000000', 'total supply isn\'t right'))
  );

  it('should be able to authenticate with the bank', async () => {
    var bank = await GrumpBank.deployed();
    var halp = await HalpCoin.deployed();

    bank.setAuthenticatedContract(halp.address);
  });
});
