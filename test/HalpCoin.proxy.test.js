// test/HalpCoin.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
 
contract('HalpCoin (proxy)', function () {
  beforeEach(async function () {
    this.halp = await deployProxy(HalpCoin);
  });
 
  it('initialized total supply', async function () {
    expect((await this.halp.totalSupply()).toString()).to.equal('10000000');
  });
});
