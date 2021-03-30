// test/HalpCoin.test.js
// Load dependencies
const { expect } = require('chai');
 
// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
 
contract('HalpCoin', function () {
  beforeEach(async function () {
    this.halp = await HalpCoin.new();
  });
 
  it('should initialize supply by default', async function () {
    expect((await this.halp.totalSupply()).toString()).to.equal('0');
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
  });
});
