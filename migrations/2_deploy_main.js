// migrations/2_deploy_box.js
const HalpCoin = artifacts.require('HalpCoin');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer) {
  await deployProxy(HalpCoin);
};
