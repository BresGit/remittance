const Promise = require("bluebird");
web3.eth = Promise.promisifyAll(web3.eth);
const {toBN}=web3.utils;
const { constants,time,expectRevert } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;
const { shouldFail } = require("openzeppelin-test-helpers");
const Remittance = artifacts.require("Remittance");

contract("Remittance", accounts =>
{

    const [bob, carol, alice] = accounts;
    let remittance;
    beforeEach(async () =>
    {

    remittance = await Remittance.new(alice, bob, carol);

    });

    it("should set up password correct as provided by Alice", async function()
    {

        const PSW = web3.utils.keccak256("12345");
        txObj = await remittance.fundsToTransfer(PSW, { from:alice, value:20 });
        const _PSW = await remittance.PSW.call();
        assert.strictEqual(PSW,_PSW, "Password is not setup correctly");
        assert.strictEqual(txObj.receipt.logs.length, 1);
        assert.strictEqual(txObj.logs.length, 1);
        const LogPSWAssigned = txObj.logs[0];
        assert.strictEqual(LogPSWAssigned.event, "LogPSWAssigned");
        assert.strictEqual((LogPSWAssigned.args[1]).toString(10), "20", "Value Send is not 20");
        assert.strictEqual(LogPSWAssigned.args[0], alice, "Sender is not Alice");

    });

    it("should match Alice with Bob and Carol Passwords", async function()
    {

        const PSW = web3.utils.keccak256("134");
        await remittance.fundsToTransfer(PSW, { from:alice, value:20 } );
        const bobPsw = "1";
        const carolPsw ="34";
        const txObj= await remittance.exchange(bobPsw, carolPsw, { from:carol } );
        assert.strictEqual(txObj.logs.length, 1);
        const logFundsTransfereToCarol = txObj.logs[0];
        assert.strictEqual("LogFundsTransfereToCarol",logFundsTransfereToCarol.event);
        assert.strictEqual((logFundsTransfereToCarol.args[1]).toString(10), "20", "Value Send is not 20");
        assert.strictEqual(logFundsTransfereToCarol.args[0], carol, "Sender is not Carol");

    })

    //  Alice is claiming back the funds since it was not withdrawn
    it("should return funds to Alice after 4 weeks, when withdrawing ", async function()
    {

        const PSW = web3.utils.keccak256("134");
        //const amount = web3.utils.toWei("1", "ether");
        const txObj = await remittance.fundsToTransfer(PSW, { from:alice, value:5});
        const logPSWAssigned = txObj.logs[0];
        assert.strictEqual(txObj.logs.length, 1);
        assert.strictEqual("LogPSWAssigned",logPSWAssigned.event);
        assert.strictEqual(logPSWAssigned.args[0],alice,"Sender is not Alice");
        assert.strictEqual(logPSWAssigned.args[1].toString(10),"5","Value send is not 5 ether");
        // fast forward time in blockchain, this can work only in test environment for blockchain
        await time.increase(time.duration.weeks(5));

        const txObj2 = await remittance.withdraw({from:alice});
        logWithdraw = txObj2.logs[0];
        assert.strictEqual(txObj2.logs.length, 1);
        assert.strictEqual("LogWithdraw",logWithdraw.event);
        assert.strictEqual(logWithdraw.args[0],alice,"Sender is not Alice");
        assert.strictEqual(logWithdraw.args[1].toString(10),"5","Value send is not 5 ether");

     })

     it("should NOT return funds to allice before deadline reached", async function()
     {

         const PSW = web3.utils.keccak256("134");
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(PSW, { from:alice, value:amount });
         const etherString = "1000000000000000000";
         logPSWAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPSWAssigned", logPSWAssigned.event);
         assert.strictEqual(logPSWAssigned.args[0], alice, "Sender is not Alice");
         assert.strictEqual(logPSWAssigned.args[1].toString(10),etherString,"Value send is not 1 ether");

         await time.increase(time.duration.years(1));
         await expectRevert(remittance.getUnclaimedFunds({ from:alice }), 'Deadline Not Reached');

     })

     it("should return funds to allice before deadline", async function()
     {

         const PSW = web3.utils.keccak256("134");
         const amount = web3.utils.toWei("1", "ether");
         const txObj = await remittance.fundsToTransfer(PSW, { from:alice, value:amount});
         const etherString = "1000000000000000000";
         logPSWAssigned = txObj.logs[0];
         assert.strictEqual(txObj.logs.length, 1);
         assert.strictEqual("LogPSWAssigned", logPSWAssigned.event);
         assert.strictEqual(logPSWAssigned.args[0], alice, "Sender is not Alice");
         assert.strictEqual(logPSWAssigned.args[1].toString(10), etherString, "Value send is not 1 ether");

         await time.increase(time.duration.years(2));
         let alliceBlncBefore = await web3.eth.getBalance(alice);
         alliceBlncBefore = toBN(alliceBlncBefore);
         const txObj2 = await remittance.getUnclaimedFunds({ from:alice });
         let alliceBlncAfter = await web3.eth.getBalance(alice);
         alliceBlncAfter = toBN(alliceBlncAfter);
         assert.isTrue(alliceBlncBefore.lt(alliceBlncAfter));

     })

});
