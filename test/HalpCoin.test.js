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
});
