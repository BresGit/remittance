const Promise = require("bluebird");
web3.eth = Promise.promisifyAll(web3.eth);
const {toBN}=web3.utils;
const { constants,time,expectRevert } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;
const { shouldFail } = require("openzeppelin-test-helpers");
const Remittance = artifacts.require("RemittanceVer2");
const RemittanceCreator = artifacts.require("RemittanceCreator");

contract("Remittance", accounts =>
{

    const [ exchangeMgr, fundSender] = accounts;
    let remittance;
    let remittanceCreator;

    beforeEach(async () =>
    {
        remittanceCreator = await RemittanceCreator.new(); //deploy the factory
        const tx = await remittanceCreator.newRemitt(exchangeMgr, fundSender); // created remittance
        const remittanceAddress = tx.logs[0].args[2];
        remittance = await Remittance.at(remittanceAddress); //we have established a conection to remitance instantiated in the creator.

    });

    it("should set up password correct as provided by fundSender", async function()
    {

        const PSW = web3.utils.keccak256("12345");
        txObj = await remittance.fundsToTransfer(PSW, { from:fundSender, value:20 });
        const _PSW = await remittance.PSW.call();
        assert.strictEqual(PSW,_PSW, "Password is not setup correctly");
        assert.strictEqual(txObj.receipt.logs.length, 1);
        assert.strictEqual(txObj.logs.length, 1);
        const LogPSWAssigned = txObj.logs[0];
        assert.strictEqual(LogPSWAssigned.event, "LogPSWAssigned");
        assert.strictEqual((LogPSWAssigned.args[1]).toString(10), "20", "Value Send is not 20");
        assert.strictEqual(LogPSWAssigned.args[0], fundSender, "Sender is not fundSender");

    });

    it("should match fundSender with fundReceiver and exchangeMgr Passwords", async function()
    {

        const PSW = web3.utils.keccak256("134");
        await remittance.fundsToTransfer(PSW, { from:fundSender, value:20 } );
        const fundReceiverPsw = "1";
        const exchangeMgrPsw ="34";
        const txObj= await remittance.exchange(fundReceiverPsw, exchangeMgrPsw, { from:exchangeMgr } );
        assert.strictEqual(txObj.logs.length, 1);
        const logFundsTransferToExchangeMgr = txObj.logs[0];
        assert.strictEqual("LogFundsTransferToExchangeMgr",logFundsTransferToExchangeMgr.event);
        assert.strictEqual((logFundsTransferToExchangeMgr.args[1]).toString(10), "20", "Value Send is not 20");
        assert.strictEqual(logFundsTransferToExchangeMgr.args[0], exchangeMgr, "Sender is not exchangeMgr");

    })

     it("should NOT return funds before deadline reached", async function()
     {

         const PSW = web3.utils.keccak256("134");
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(PSW, { from:fundSender, value:amount });
         const etherString = "1000000000000000000";
         logPSWAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPSWAssigned", logPSWAssigned.event);
         assert.strictEqual(logPSWAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(logPSWAssigned.args[1].toString(10),etherString,"Value send is not 1 ether");

         // increasing time (now)  for testing purposes
         await time.increase(time.duration.weeks(6));
         // trying to claim funds before 8 weeks and expect not to work/pass
         await expectRevert(remittance.getUnclaimedFunds(true, { from:fundSender }), "Deadline Not Reached To Claim Back the funds");
         await expectRevert(remittance.getUnclaimedFunds(false, { from:fundSender }), "Deadline Not Reached To Claim Back the funds");

     })

     it("should return funds to fundSender after deadline", async function()
     {

         const PSW = web3.utils.keccak256("134");
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(PSW, { from:fundSender, value:amount});
         const etherString = "1000000000000000000";
         logPSWAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPSWAssigned", logPSWAssigned.event);
         assert.strictEqual(logPSWAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(logPSWAssigned.args[1].toString(10), etherString, "Value send is not 1 ether");

         await time.increase(time.duration.weeks(12));
         let fundSenderBlncBefore = await web3.eth.getBalance(fundSender);
         fundSenderBlncBefore = toBN(fundSenderBlncBefore);
         const txObj2 = await remittance.getUnclaimedFunds(true, { from:fundSender });
         let fundSenderBlncAfter = await web3.eth.getBalance(fundSender);
         fundSenderBlncAfter = toBN(fundSenderBlncAfter);
         assert.isTrue(fundSenderBlncBefore.lt(fundSenderBlncAfter));

     })


});
