// migrations/2_deploy_box.js

const MeowDAO = artifacts.require('MeowDAO');
const Grumpy = artifacts.require('Grumpy');
const FuelTank = artifacts.require('GrumpyFuelTank');
 
module.exports = async function (deployer, network, [defaultAccount]) {
  /*
  if (network.startsWith('rinkeby')) { }
  else if (network.startsWith('kovan')) { }
  else { }
  */

  let grumpyAddress;
  let g;

  if (network.startsWith('test')) {
    g = await deployer.deploy(Grumpy);
    grumpyAddress = Grumpy.address;
  }
  else {
    grumpyAddress = '0x15388d9E6F6573C44f519B0b1B42397843e7fC56';
    g = await Grumpy.at(grumpyAddress);
  }

  await deployer.deploy(FuelTank, grumpyAddress);

  await deployer.deploy(MeowDAO, grumpyAddress, FuelTank.address);

  let ft = await FuelTank.deployed();
  let meow = await MeowDAO.deployed();

  await ft.addMeowDAOaddress(MeowDAO.address);

  if (!network.startsWith('test')) {
    await g.approve(meow.address, '10000000000000000000');
    await meow.swapGrumpy('10000000000000000000');

    await meow._testAdvanceEndTime();
    await meow.initializeCoinThruster();
  }
};
