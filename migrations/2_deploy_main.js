// migrations/2_deploy_box.js
const { LinkToken } = require('@chainlink/contracts/truffle/v0.4/LinkToken')
const { Oracle } = require('@chainlink/contracts/truffle/v0.6/Oracle')

const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer, network, [defaultAccount]) {
  LinkToken.setProvider(deployer.provider)
  Oracle.setProvider(deployer.provider)

  await deployer.deploy(LinkToken, { from: defaultAccount })
  await deployer.deploy(Oracle, LinkToken.address, { from: defaultAccount })

  const jobId = web3.utils.toHex('4c7b7ffb66b344fbaa64995af81e355a')

  await deployer.deploy(GrumpBank, LinkToken.address, Oracle.address, jobId);

  //var g = await GrumpBank.deployed();

  //await deployProxy(HalpCoin, [GrumpBank.address]);
  await deployProxy(HalpCoin, [GrumpBank.address],  { deployer, initializer: '__HalpCoin_init' });
};
