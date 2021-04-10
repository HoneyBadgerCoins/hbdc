// migrations/2_deploy_box.js

const HalpCoin = artifacts.require('HalpCoin');
const Grumpy = artifacts.require('Grumpy');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer, network, [defaultAccount]) {
  if (network.startsWith('rinkeby')) {
  }
  else if (network.startsWith('kovan')) {
  }
  else {
  }

  await deployer.deploy(Grumpy);
  //await deployProxy(HalpCoin, [Grumpy.address]);
  await deployProxy(HalpCoin, [Grumpy.address],  { deployer, initializer: '__HalpCoin_init' });
};
