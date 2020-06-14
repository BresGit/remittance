pragma solidity ^0.5.0;
contract RemittanceVer2
{

    //There are three parties/people in this process: Fund Sender, Fund Exchange Manager and the party that receives the funds after the currency is exchanged .
    //The fund sender  wants to send funds to a party, but the fund sender  only has ether & the fund receiver  does not care about Ether and wants to be paid in local currency.
    //luckily, Fund Echange Manager  runs an exchange shop that converts ether to local currency.

    address public fundSender;
    address public exchangeMgr;
    bool isRunning;


    struct Remittance {
        uint256 startDeadline;
        uint256 addOnDeadline;
        uint256 valueSend;
        bool claimedFunds;
    }

    mapping (bytes32 => Remittance) public remittances;

    event LogFundsTransferToExchangeMgr(address sender, uint256 balance);
    event LogPswAssigned(address sender, uint256 value, bytes32 _hashedPassword);
    event LogWithdraw(address requester, uint256 value);
    event LogGetFunds(address requester, uint256 value);
    event LogPausedContract(address sender);
    event LogResumeContract(address sender);

    modifier onlyIfRunning {
        require(isRunning, 'Contract Paused');
        _;

    }

    constructor (address _exchangeMgr, address _fundSender) public
    {

        require(_exchangeMgr != address(0), 'Adress cant be zero');
        require(_fundSender != address(0), 'Adress cant be zero');
        exchangeMgr = _exchangeMgr;
        fundSender  = _fundSender;
        isRunning = true;

    }

    function fundsToTransfer(bytes32 _hashedPassword,uint _addOnDeadline) public payable onlyIfRunning
    {

        require(msg.sender == fundSender, "Fund Sender must be the Sender");
        require(msg.value > 0, "Value must be greater > 0");
        require(remittances[_hashedPassword].startDeadline == 0, "Initial Password alredy Used");
        Remittance memory newRemittance;

        newRemittance.startDeadline = now; //now is solidity global variable
        newRemittance.addOnDeadline = _addOnDeadline;
        newRemittance.valueSend = msg.value;
        remittances[_hashedPassword] = newRemittance;

        emit LogPswAssigned(msg.sender, msg.value, _hashedPassword);

    }

    // exchange is executed after fund receiver  and exchange manager  met and fundeceiver provided his part of PSW, now the funds in ether can be released
    function exchange(string memory _fundsReceiverPsw, string memory _exchangeMgrPsw) public onlyIfRunning returns (bool)
    {

        uint funds = (address(this).balance);
        require(funds > 0);
        require(exchangeMgr == msg.sender);

        bytes32 hashedPassword = keccak256(abi.encodePacked(_fundsReceiverPsw, _exchangeMgrPsw));
        require(remittances[hashedPassword].startDeadline > 0, "Password Does Not Exist");

        emit LogFundsTransferToExchangeMgr(msg.sender, remittances[hashedPassword].valueSend);

        (bool success, ) = msg.sender.call.value(remittances[hashedPassword].valueSend)("");
        require(success, "TRansfer Failed");
        remittances[hashedPassword].claimedFunds = true;
        return true;

    }

    function getUnclaimedFunds(bytes32 _hashedPassword) public onlyIfRunning
    {

        require(fundSender == msg.sender, "sender is not Fund Sender");
        require(now > remittances[_hashedPassword].startDeadline + remittances[_hashedPassword].addOnDeadline, "Deadline Not Reached To Claim Back the funds");

        uint256 valueSend = remittances[_hashedPassword].valueSend;
        require(remittances[_hashedPassword].claimedFunds != true, "Funds Claimed already");
        require(address(this).balance >= valueSend, "No Balance to return");
        emit LogGetFunds(msg.sender, valueSend);
        (bool success, ) = msg.sender.call.value(valueSend)("");
        require(success, "Transfer Failed");

    }

    function pauseContract() public onlyIfRunning returns(bool success)
    {

        require(msg.sender == fundSender, "Pause requested not by Fund Sender");
        isRunning = false;
        emit LogPausedContract(msg.sender);
        return true;
    }

    function resumeContract() public  returns(bool success)
    {

        require(msg.sender == fundSender, "Resume requested not by Fund Sender");
        isRunning = true;
        emit LogResumeContract(msg.sender);
        return true;
    }
}
