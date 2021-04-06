// test/HalpCoin.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const { LinkToken } = require('@chainlink/contracts/truffle/v0.4/LinkToken')
const { Oracle } = require('@chainlink/contracts/truffle/v0.6/Oracle')
 
// Load compiled artifacts
const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
contract('HalpCoin (proxy)', function ([defaultAccount]) {
  const jobId = web3.utils.toHex('4c7b7ffb66b344fbaa64995af81e355a')
  let link, oc;
  beforeEach(async function () {
    link = await LinkToken.new({ from: defaultAccount })
    oc = await Oracle.new(link.address, { from: defaultAccount })

    this.bank = await GrumpBank.new(link.address, oc.address, jobId);
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
