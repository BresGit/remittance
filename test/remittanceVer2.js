const Promise = require("bluebird");
web3.eth = Promise.promisifyAll(web3.eth);
const {toBN}=web3.utils;
const { constants,time,expectRevert } = require('openzeppelin-test-helpers');
const { shouldFail } = require("openzeppelin-test-helpers");
const Remittance = artifacts.require("RemittanceVer2");
const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
chai.use(bnChai(BN));

contract("Remittance", accounts =>
{
    const [owner, exchangeMgr,fundSender] = accounts;
    let remittance;

    beforeEach(async () =>
    {

        remittance = await Remittance.new();

    });

    it("should set up password correct as provided by fundSender", async function()
    {

        const hashedPassword = web3.utils.keccak256("12345");
        const addOnDeadline = 8 * 7 * 24 * 60 * 60;
        await remittance.fundsToTransfer(hashedPassword,  addOnDeadline, exchangeMgr, { from:fundSender, value:20 });

        const remittanceStruct = await remittance.remittances(hashedPassword);

        assert.strictEqual(addOnDeadline,(remittanceStruct.addOnDeadline).toNumber(), "addOnDeadline is not setup correctly");
        assert.strictEqual(20,(remittanceStruct.valueSend).toNumber(), "valueSend is not setup correctly");

    });

    it("should match fundSender with fundReceiver and exchangeMgr Passwords", async function()
    {

        const hashedPassword = web3.utils.keccak256("134");
        const addOnDeadline = 8 * 7 * 24 * 60 * 60;
        await remittance.fundsToTransfer(hashedPassword, addOnDeadline, exchangeMgr, { from:fundSender, value:20 } );
        const fundReceiverPsw = "1";
        const exchangeMgrPsw ="34";
        const txObj= await remittance.exchange(fundReceiverPsw, exchangeMgrPsw, { from:exchangeMgr } );
        assert.strictEqual(txObj.logs.length, 1);
        const logFundsTransferToExchangeMgr = txObj.logs[0];
        assert.strictEqual("LogFundsTransferToExchangeMgr", logFundsTransferToExchangeMgr.event);
        assert.strictEqual((logFundsTransferToExchangeMgr.args[1]).toString(10), "20", "Value Send is not 20");
        assert.strictEqual(logFundsTransferToExchangeMgr.args[0], exchangeMgr, "Sender is not exchangeMgr");

    })

     it("should NOT return funds before deadline reached", async function()
     {

         const hashedPassword = web3.utils.keccak256("134");
         const addOnDeadline = 6 * 7 * 24 * 60 * 60;
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(hashedPassword, addOnDeadline, exchangeMgr, { from:fundSender, value:amount });
         const etherString = web3.utils.toWei("1", "ether");
         const LogPswAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPswAssigned", LogPswAssigned.event);
         assert.strictEqual(LogPswAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(LogPswAssigned.args[1].toString(10),etherString,"Value send is not 1 ether");

         await time.increase(time.duration.weeks(5));
         await expectRevert(remittance.getUnclaimedFunds(hashedPassword, { from:fundSender }), "Deadline Not Reached To Claim Back the funds");

     })

     it("should return funds to fundSender after deadline", async function()
     {

         const hashedPassword = web3.utils.keccak256("134");
         const addOnDeadline = 10 * 7 * 24 * 60 * 60;
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(hashedPassword, addOnDeadline, exchangeMgr, { from:fundSender, value:amount});
         const etherString = web3.utils.toWei("1", "ether");
         const LogPswAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPswAssigned", LogPswAssigned.event);
         assert.strictEqual(LogPswAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(LogPswAssigned.args[1].toString(10), etherString, "Value send is not 1 ether");

         await time.increase(time.duration.weeks(12));
         let fundSenderBlncBefore = await web3.eth.getBalance(fundSender);
         const txObj2 = await remittance.getUnclaimedFunds(hashedPassword, { from:fundSender });
         let fundSenderBlncAfter = await web3.eth.getBalance(fundSender);

         expect(new BN(fundSenderBlncBefore)).to.be.lt.BN(fundSenderBlncAfter);

     })

     it("should pause and resume the contract", async function()
     {

        const hashedPassword = web3.utils.keccak256("12345");
        const addOnDeadline = 8 * 7 * 24 * 60 * 60;
        await remittance.fundsToTransfer(hashedPassword,  addOnDeadline, exchangeMgr, { from:fundSender, value:20 });
        await remittance.pauseContract({ from:owner });

        const amount = web3.utils.toWei("1", "ether");
        await expectRevert(remittance.fundsToTransfer(hashedPassword, addOnDeadline, exchangeMgr, { from:fundSender, value:amount }), "Pausable: paused");
        await expectRevert(remittance.pauseContract( { from:owner }),"Pausable: paused");
        await expectRevert(remittance.getUnclaimedFunds(hashedPassword, { from:fundSender }), "Pausable: paused");

        const fundReceiverPsw = "12";
        const exchangeMgrPsw = "345";
        await expectRevert(remittance.exchange(fundReceiverPsw, exchangeMgrPsw, { from:exchangeMgr } ), "Pausable: paused");

        await remittance.resumeContract( { from:owner });
        await expectRevert(remittance.fundsToTransfer(hashedPassword,  addOnDeadline, exchangeMgr, { from:fundSender, value:20 } ), "Initial Password Already Used") ;
        const hashedPasswordNext = web3.utils.keccak256("12399");
        await remittance.fundsToTransfer(hashedPasswordNext, addOnDeadline, exchangeMgr, { from:fundSender, value:amount});
        await remittance.exchange(fundReceiverPsw, exchangeMgrPsw, { from:exchangeMgr } );

     })

});
