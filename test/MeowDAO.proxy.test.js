// test/MeowDAOwo.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');
const FuelTank = artifacts.require('GrumpyFuelTank');
 
contract('MeowDAO (proxy)', function ([defaultAccount]) {
  beforeEach(async function () {
    this.grumpy = await Grumpy.new();
    this.fuelTank = await FuelTank.new(this.grumpy.address);
    this.meow = await deployProxy(MeowDAO, [this.grumpy.address, this.fuelTank.address], {initializer: '__MeowDAO_init'});
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

  
  it('contract start time should be initialized properly', async function () {
    const blocktime = await this.meow.getBlockTime();
    const startTime = await this.meow.contractStart();
    // console.log(blocktime.toString());
    // console.log(startTime.toString());
    expect((blocktime).toString()).to.equal(startTime.toString());
  });

  //starting supply of meowdao is 100_000_000_000_000.000_000_000 or 1*10 ^23
  //0.05 of meowdao is 5_000_000_000_000.000_000_000 or 5*10^21
  it('operation fund should be 0.05 of the total starting supply which is 5*10^21  ', async function () { 
    expect((await this.meow.operFund()).toString()).to.equal('5000000000000000000000');
  });




});
