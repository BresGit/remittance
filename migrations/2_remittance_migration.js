const Remittance = artifacts.require('Remittance.sol');

module.exports = function(deployer, network, accounts) {

  const [ alice, bob, carol ] = accounts;
  deployer.deploy(Remittance, alice, bob, carol);
};
