const RemittanceCreator = artifacts.require('RemittanceCreator.sol');

module.exports = function(deployer, network, accounts) {

  deployer.deploy(RemittanceCreator);

};
