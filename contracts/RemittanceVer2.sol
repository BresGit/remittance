pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RemittanceVer2 is Pausable, Ownable
{

    //There are three parties/people in this process: Fund Sender, Fund Exchange Manager and the party that receives the funds after the currency is exchanged .
    //The fund sender  wants to send funds to a party, but the fund sender  only has ether & the fund receiver  does not care about Ether and wants to be paid in local currency.
    //luckily, Fund Echange Manager  runs an exchange shop that converts ether to local currency.

    using SafeMath for uint256;

    struct Remittance {
        address fundSender;
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

    constructor () public
    {

    }

    function fundsToTransfer(bytes32 _hashedPassword,uint _addOnDeadline) public payable whenNotPaused
    {

        require(msg.value > 0, "Value must be greater > 0");
        require(remittances[_hashedPassword].startDeadline == 0, "Initial Password Already Used");

        Remittance memory newRemittance;

        newRemittance.fundSender = msg.sender;
        newRemittance.startDeadline = now; //now is solidity global variable
        newRemittance.addOnDeadline = _addOnDeadline;
        newRemittance.valueSend = msg.value;
        remittances[_hashedPassword] = newRemittance;

        emit LogPswAssigned(msg.sender, msg.value, _hashedPassword);

    }

    // exchange is executed after fund receiver  and exchange manager  met and fundeceiver provided his part of PSW, now the funds in ether can be released
    function exchange(string memory _fundsReceiverPsw, string memory _exchangeMgrPsw) public whenNotPaused returns (bool)
    {

        bytes32 hashedPassword = keccak256(abi.encodePacked(_fundsReceiverPsw, _exchangeMgrPsw,msg.sender));
        require(remittances[hashedPassword].fundSender != msg.sender, "fund sender is exchange mgr ");
        require(!remittances[hashedPassword].claimedFunds, "funds already claimed");

        remittances[hashedPassword].claimedFunds = true;

        emit LogFundsTransferToExchangeMgr(msg.sender, remittances[hashedPassword].valueSend);

        (bool success, ) = msg.sender.call.value(remittances[hashedPassword].valueSend)("");
        require(success, "TRansfer Failed");

        return true;

    }

    function getUnclaimedFunds(bytes32 _hashedPassword) public whenNotPaused
    {

        require(remittances[_hashedPassword].fundSender == msg.sender, "sender is not Fund Sender");
        require(now > (remittances[_hashedPassword].startDeadline.add( remittances[_hashedPassword].addOnDeadline)), "Deadline Not Reached To Claim Back the funds");

        require(remittances[_hashedPassword].claimedFunds != true, "Funds Claimed already");
        remittances[_hashedPassword].claimedFunds = true;

        uint256 valueSend = remittances[_hashedPassword].valueSend;
        emit LogGetFunds(msg.sender, valueSend);
        (bool success, ) = msg.sender.call.value(valueSend)("");
        require(success, "Transfer Failed");

    }

    function pauseContract() public  onlyOwner returns(bool success)
    {

        _pause();
        return true;
    }

    function resumeContract() public   onlyOwner returns(bool success)
    {

        _unpause();
        return true;
    }

    function generateHash(string memory _password,address _exchangeMgr) public view returns(bytes32 )
    {

        bytes32 hashedPassword = keccak256(abi.encodePacked(_password, _exchangeMgr));

        return hashedPassword;

    }
}
