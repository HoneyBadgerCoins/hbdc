// migrations/2_deploy_box.js

const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');
const FuelTank = artifacts.require('GrumpyFuelTank');
 
const { deployProxy, upgradeProxy, prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer, network, [defaultAccount]) {
  /*
  if (network.startsWith('rinkeby')) { }
  else if (network.startsWith('kovan')) { }
  else { }
  */

  let grumpyAddress;

  if (network.startsWith('test')) {
    await deployer.deploy(Grumpy);
    grumpyAddress = Grumpy.address;
  }
  else {
    grumpyAddress = '0x15388d9E6F6573C44f519B0b1B42397843e7fC56';
  }

  await deployer.deploy(FuelTank, grumpyAddress);

  //await deployer.deploy(Grumpy);
  //await deployProxy(MeowDAO, [Grumpy.address],  { deployer, initializer: '__MeowDAO_init' });
  await deployProxy(MeowDAO, [grumpyAddress, FuelTank.address],  { deployer, initializer: '__MeowDAO_init' });
  //await prepareUpgrade(MeowDAO, [grumpyAddress, FuelTank.address],  { deployer, initializer: '__MeowDAO_init' });

  await FuelTank.deployed().then(f => f.addMeowDAOaddress(MeowDAO.address));
};
