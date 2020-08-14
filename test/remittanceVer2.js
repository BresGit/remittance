const Promise = require("bluebird");
web3.eth = Promise.promisifyAll(web3.eth);
const {toBN,toWei} = web3.utils;
const {getBalance} = web3.eth;
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
    const eightWeeks = 8 * 7 * 24 * 60 * 60;

    async function calcTransCost(txObj)
        {

        const gasUsed = toBN(txObj.receipt.gasUsed);
        const transDetails = await web3.eth.getTransaction(txObj.tx);
        const gasPrice = transDetails.gasPrice;

        return gasUsed.mul(toBN(gasPrice));

        }

    beforeEach("Deploying Remittance", async () =>
    {

        remittance = await Remittance.new();

    });

    it("should set up password correct as provided by fundSender", async function()
    {

        const hashedPassword = await remittance.generateHash(134 ,exchangeMgr);
        const tx = await remittance.fundsToTransfer(hashedPassword, eightWeeks, { from:fundSender, value:20 });

        await expectRevert(remittance.fundsToTransfer(hashedPassword,  eightWeeks, { from:fundSender, value:20 }), "Initial Password Already Used");

        const blockNumber = tx.receipt.blockNumber;
        const blockDetail = await web3.eth.getBlock(blockNumber);
        const now = blockDetail.timestamp;
        assert.strictEqual(tx.logs.length, 1);
        const LogPswAssigned = tx.logs[0];

        assert.strictEqual("LogPswAssigned", LogPswAssigned.event);
        assert.strictEqual(LogPswAssigned.args[0], fundSender, "Sender is not fundSender");
        assert.strictEqual(LogPswAssigned.args[1].toString(10), "20","Value send is not 20 Wei");
        assert.strictEqual(LogPswAssigned.args[2],hashedPassword, "Hashed Password does not match");

        const remittanceStruct = await remittance.remittances(hashedPassword);

        assert.strictEqual(eightWeeks + now ,(remittanceStruct.deadline).toNumber(), "deadline is not setup correctly");
        assert.strictEqual(20,(remittanceStruct.valueSend).toNumber(), "valueSend is not setup correctly");

    });

    it("should match fundSender with fundReceiver and exchangeMgr Passwords", async function()
    {

        const hashedPassword = await remittance.generateHash(1234, exchangeMgr);
        const amount = 200000;

        await remittance.fundsToTransfer(hashedPassword, eightWeeks, { from:fundSender, value:amount} );

        const fundReceiverPsw = 1234;
        const exchangeMgrBlncBeforeBN = toBN(await getBalance(exchangeMgr));
        const txObj= await remittance.exchange(fundReceiverPsw, { from:exchangeMgr } );
        const trCost = await calcTransCost(txObj);
        const exchangeMgrBlncAfter = await getBalance(exchangeMgr);
        const expectedBalance  = exchangeMgrBlncBeforeBN.sub(trCost).add(toBN(amount));

        assert.strictEqual(expectedBalance.toString(10),exchangeMgrBlncAfter,"Final Balance not Equal");

        await expectRevert(remittance.fundsToTransfer(hashedPassword,  eightWeeks, { from:fundSender, value:20 }), "Initial Password Already Used");

        assert.strictEqual(txObj.logs.length, 1);

        const logFundsTransferToExchangeMgr = txObj.logs[0];

        assert.strictEqual("LogFundsTransferToExchangeMgr", logFundsTransferToExchangeMgr.event);
        assert.equal((logFundsTransferToExchangeMgr.args[1]).toString(10), amount, "Value Send is not 200000");
        assert.strictEqual(logFundsTransferToExchangeMgr.args[0], exchangeMgr, "Sender is not exchangeMgr");

    })

     it("should NOT return funds before deadline reached", async function()
     {

         const hashedPassword = await remittance.generateHash(134, exchangeMgr);
         const amount = toWei("0.001", "ether");
         const txObj = await remittance.fundsToTransfer(hashedPassword, eightWeeks, { from:fundSender, value:amount });
         const etherString = toWei("0.001", "ether");
         const LogPswAssigned = txObj.logs[0];

         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPswAssigned", LogPswAssigned.event);
         assert.strictEqual(LogPswAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(LogPswAssigned.args[1].toString(10), etherString, "Value send is not 0.001 ether");

         const remittanceStruct = await remittance.remittances(hashedPassword);

         assert.strictEqual(LogPswAssigned.args[3].toString(10), remittanceStruct.deadline.toString(10), "Deadline not equal");

         await time.increase(time.duration.weeks(5));
         await expectRevert(remittance.getUnclaimedFunds(hashedPassword, { from:fundSender }), "Deadline Not Reached To Claim Back the funds");

     })

     it("should return funds to fundSender after deadline", async function()
     {

         const hashedPassword = await remittance.generateHash(134, exchangeMgr);
         const amount = toWei("0.001", "ether");
         const txObj = await remittance.fundsToTransfer(hashedPassword, eightWeeks, { from:fundSender, value:amount});
         const etherString = toWei("0.001", "ether");
         const LogPswAssigned = txObj.logs[0];

         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPswAssigned", LogPswAssigned.event);
         assert.strictEqual(LogPswAssigned.args[0], fundSender, "Sender is not fundSender");
         assert.strictEqual(LogPswAssigned.args[1].toString(10), etherString, "Value send is not 0.001 ether");

         await time.increase(time.duration.weeks(12));
         await expectRevert(remittance.getUnclaimedFunds(hashedPassword, { from:exchangeMgr }), "sender is not Fund Sender");

         const fundSenderBlncBeforeBN = toBN(await getBalance(fundSender));
         const txObj2 = await remittance.getUnclaimedFunds(hashedPassword, { from:fundSender });
         const fundSenderBlncAfter = await getBalance(fundSender);
         const fundSenderBlncAfterBN  = toBN(fundSenderBlncAfter);
         const trCost = await calcTransCost(txObj2);
         const p2ExpectedBalance  = fundSenderBlncBeforeBN.sub(trCost).add(toBN(amount));

         assert.strictEqual(p2ExpectedBalance.toString(10), fundSenderBlncAfterBN.toString(10),
        "Expected balance not equal After Withdraw Balance");

        await expectRevert(remittance.exchange(134, { from:exchangeMgr } ) ,"funds already claimed");

     })

     it("should pause and resume the contract", async function()
     {

        const hashedPassword = await remittance.generateHash(123, exchangeMgr);

        await remittance.fundsToTransfer(hashedPassword,  eightWeeks,  { from:fundSender, value:20 });
        await remittance.pauseContract({ from:owner });

        const amount = toWei("0.001", "ether");

        await expectRevert(remittance.fundsToTransfer(hashedPassword, eightWeeks, { from:fundSender, value:amount }), "Pausable: paused");
        await expectRevert(remittance.pauseContract( { from:owner }), "Pausable: paused");
        await expectRevert(remittance.getUnclaimedFunds(hashedPassword, { from:fundSender }), "Pausable: paused");

        const fundReceiverPsw = 123;

        await expectRevert(remittance.exchange(fundReceiverPsw, { from:exchangeMgr } ), "Pausable: paused");
        await remittance.resumeContract( { from:owner });
        await expectRevert(remittance.fundsToTransfer(hashedPassword,  eightWeeks, { from:fundSender, value:20 } ), "Initial Password Already Used") ;

        const hashedPasswordNext = await remittance.generateHash("12399", exchangeMgr);
        await remittance.fundsToTransfer(hashedPasswordNext, eightWeeks, { from:fundSender, value:amount});
        await remittance.exchange(fundReceiverPsw, { from:exchangeMgr } );

     })

});
