// migrations/2_deploy_box.js

const MeowDAO = artifacts.require('MeowDAO');
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
  //await deployProxy(MeowDAO, [Grumpy.address],  { deployer, initializer: '__MeowDAO_init' });
};
