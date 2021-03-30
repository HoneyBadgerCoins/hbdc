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
    const yielded = await this.halp.calculateYield(10000, 1)
    expect(yielded.toString()).to.equal("10500");

    const yielded2 = await this.halp.calculateYield(10000, 2)
    expect(yielded2.toString()).to.equal("11025");
  });
});
