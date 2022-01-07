// migrations/2_deploy_box.js

const HBDC = artifacts.require('HBDC');
 
module.exports = async function (deployer, network, [defaultAccount]) {
  await deployer.deploy(HBDC, '0x57469B96A5d2F67300964ced5fa99f0C836F0C52', '0x57469B96A5d2F67300964ced5fa99f0C836F0C52');
  let hbdc = await HBDC.deployed();
  console.log(hbdc.address);
};
