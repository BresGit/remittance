pragma solidity ^0.5.0;
contract RemittanceVer2
{

    //There are three parties/people in this process: Fund Sender, Fund Exchange Manager and the party that receives the funds after the currency is exchanged .
    //The fund sender  wants to send funds to a party, but the fund sender  only has ether & the fund receiver  does not care about Ether and wants to be paid in local currency.
    //luckily, Fund Echange Manager  runs an exchange shop that converts ether to local currency.

    address public fundSender;
    address public exchangeMgr;
    uint256 public startDeadline;
    bytes32 public PSW;

    event LogFundsTransferToExchangeMgr(address sender, uint256 balance);
    event LogPSWAssigned(address sender, uint256 value);
    event LogWithdraw(address requester, uint256 value);
    event LogGetFunds(address requester, uint256 value);

    constructor (address _exchangeMgr, address _fundSender) public
    {

       exchangeMgr = _exchangeMgr;
       fundSender  = _fundSender;

    }

    function fundsToTransfer(bytes32 _PSW) public payable
    {

        require(msg.sender==fundSender, "Fund Sender must be the Fund Sender");
        require(msg.value > 0, "Value must be greater > 0");

        startDeadline = now; //now is solidity global variable
        PSW = _PSW; //the full hashed password
        emit LogPSWAssigned(msg.sender, msg.value);

    }

    // exchange is executed after fund receiver  and exchange manager  met and Bob provided his part of PSW, now the funds in ether can be released
    function exchange(string memory _fundsReceiverPsw, string memory _exchangeMgrPsw) public returns (bool)
    {

        uint funds = (address(this).balance);
        require(funds > 0);
        require(msg.sender==exchangeMgr);
        require(PSW == keccak256(abi.encodePacked(_fundsReceiverPsw, _exchangeMgrPsw)), "Password Does Not Match");
        emit LogFundsTransferToExchangeMgr(msg.sender, funds);

        (bool success, ) = msg.sender.call.value(funds)("");
        require(success, "TRansfer Failed");
        return true;

    }

    function getUnclaimedFunds(bool destruct) public
    {

        require(fundSender == msg.sender, "sender is not Fund Sender");
        require(now > startDeadline + 8 weeks, "Deadline Not Reached To Claim Back the funds");

        if (destruct)
        {
            selfdestruct(msg.sender);
        }
        else
        {
            require(address(this).balance > 0, "No Balance to return");
            emit LogGetFunds(msg.sender, address(this).balance);
            (bool success, ) = msg.sender.call.value(address(this).balance)("");
            require(success, "Transfer Failed");
        }
    }
}
