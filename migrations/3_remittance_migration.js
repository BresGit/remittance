const RemittanceVer2 = artifacts.require('RemittanceVer2.sol');

module.exports = function(deployer, network, accounts) {

  const [ exchangeMgr, fundSender ] = accounts;
  deployer.deploy(RemittanceVer2, exchangeMgr, fundSender);
  
};
