// migrations/2_deploy_box.js
const HalpCoin = artifacts.require('HalpCoin');
const GrumpBank = artifacts.require('GrumpBank');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer) {
  await deployer.deploy(GrumpBank);

  //var g = await GrumpBank.deployed();

  //await deployProxy(HalpCoin, [GrumpBank.address]);
  await deployProxy(HalpCoin, [GrumpBank.address],  { deployer, initializer: '__HalpCoin_init' });
};
