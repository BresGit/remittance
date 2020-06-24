const RemittanceVer2 = artifacts.require('RemittanceVer2.sol');

module.exports = function(deployer, network, accounts) {

  deployer.deploy(RemittanceVer2);

};
