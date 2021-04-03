// test/HalpCoin.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
contract('HalpCoin (proxy)', function () {
  beforeEach(async function () {
    this.bank = await GrumpBank.new();
    this.halp = await deployProxy(HalpCoin, [this.bank.address], {initializer: '__HalpCoin_init'});
  });
 
  it('initialized total supply', async function () {
    expect((await this.halp.totalSupply()).toString()).to.equal('0');
  });
});
