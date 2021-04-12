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

  //await deployer.deploy(Grumpy);
  //await deployProxy(MeowDAO, [Grumpy.address],  { deployer, initializer: '__MeowDAO_init' });
  await deployProxy(MeowDAO, ['0x15388d9E6F6573C44f519B0b1B42397843e7fC56'],  { deployer, initializer: '__MeowDAO_init' });
};
