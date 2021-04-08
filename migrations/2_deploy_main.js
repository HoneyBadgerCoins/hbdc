// migrations/2_deploy_box.js
const { LinkToken } = require('@chainlink/contracts/truffle/v0.4/LinkToken')
const { Oracle } = require('@chainlink/contracts/truffle/v0.6/Oracle')

const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer, network, [defaultAccount]) {

  let linkAddress, oracleAddress, jobIdRaw;

  if (network.startsWith('rinkeby')) {
    oracleAddress = '0xC361e04Aa8637FB12bf1bc6261D8160fb317d751';
    linkAddress = '0x0000000000000000000000000000000000000000';
    jobIdRaw = 'f822043129b845f88b7552ae73f65bf6';
  }
  else {
    LinkToken.setProvider(deployer.provider)
    Oracle.setProvider(deployer.provider)

    await deployer.deploy(LinkToken, { from: defaultAccount })
    await deployer.deploy(Oracle, LinkToken.address, { from: defaultAccount })

    linkAddress = LinkToken.address;
    oracleAddress = Oracle.address;

    jobIdRaw = '7521b42e909d4d66a64780a8ed8c9f5e';
  }

  const jobId = web3.utils.toHex(jobIdRaw);

  await deployer.deploy(GrumpBank, linkAddress, oracleAddress, jobId);

  //var g = await GrumpBank.deployed();

  //await deployProxy(HalpCoin, [GrumpBank.address]);
  await deployProxy(HalpCoin, [GrumpBank.address],  { deployer, initializer: '__HalpCoin_init' });
};
