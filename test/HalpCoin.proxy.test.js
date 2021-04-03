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
 
  it('Initialized total supply should be 0', async function () {
    expect((await this.halp.totalSupply()).toString()).to.equal('0');
  });

  it('The name should equal to MeowDaw', async function()  {
    const name  = await this.halp.name();
    expect(name).to.equal('MeowDAO');

  });

  it('The symbol should equal to Meow', async function()  {
    const symbol= await this.halp.symbol();
    expect(symbol).to.equal('Meow');

  });

});
