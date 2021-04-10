// test/MeowDAOwo.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');
 
contract('MeowDAO (proxy)', function ([defaultAccount]) {
  beforeEach(async function () {
    this.grumpy = await Grumpy.new();
    this.meow = await deployProxy(MeowDAO, [this.grumpy.address], {initializer: '__MeowDAO_init'});
  });
 
  it('Initialized total supply should be 0', async function () {
    expect((await this.meow.totalSupply()).toString()).to.equal('0');
  });

  it('The name should equal to MeowDaw', async function()  {
    const name  = await this.meow.name();
    expect(name).to.equal('MeowDAO');

  });

  it('The symbol should equal to Meow', async function()  {
    const symbol= await this.meow.symbol();
    expect(symbol).to.equal('Meow');

  });

  it('Initialized decimals should be 9', async function () {
    expect((await this.meow.decimals()).toString()).to.equal('9');
  });

});
