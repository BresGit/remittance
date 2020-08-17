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
        uint256 deadline;
        uint256 valueSend;

    }

    mapping (bytes32 => Remittance) public remittances;

    event LogFundsTransferToExchangeMgr(address indexed sender, uint256 balance, bytes32 indexed hashedPassword);
    event LogPswAssigned(address indexed sender, uint256 value, bytes32 indexed hashedPassword, uint256 deadline);
    event LogGetFunds(address indexed requester, uint256 value, bytes32 indexed hashedPassword);

    constructor () public
    {

    }

    function fundsToTransfer(bytes32 _hashedPassword,uint _addOnDeadline) public payable whenNotPaused returns (bool success)
    {

        require(msg.value > 0, "Value must be greater > 0");
        require(remittances[_hashedPassword].deadline == 0, "Initial Password Already Used");

        Remittance memory newRemittance;

        newRemittance.fundSender = msg.sender;
        newRemittance.deadline = now.add(_addOnDeadline);
        newRemittance.valueSend = msg.value;
        remittances[_hashedPassword] = newRemittance;

        emit LogPswAssigned(msg.sender, msg.value, _hashedPassword, newRemittance.deadline);

        return true;

    }

    // exchange is executed after fund receiver  and exchange manager  met and fundeceiver provided his part of PSW, now the funds in ether can be released
    function exchange(uint256 _fundsReceiverPsw) public whenNotPaused returns (bool success)
    {

        bytes32 hashedPassword = generateHash(_fundsReceiverPsw,msg.sender);
        uint256 valueSend = remittances[hashedPassword].valueSend;

        require(valueSend != 0, "funds already claimed");

        remittances[hashedPassword].valueSend = 0;
        remittances[hashedPassword].fundSender = address(0);

        emit LogFundsTransferToExchangeMgr(msg.sender, valueSend, hashedPassword);

        (bool success, ) = msg.sender.call.value(valueSend)("");
        require(success, "Transfer Failed");

        return true;
    }

    function getUnclaimedFunds(bytes32 _hashedPassword) public whenNotPaused returns (bool success)
    {

        require(remittances[_hashedPassword].fundSender == msg.sender, "sender is not Fund Sender");
        require(now > remittances[_hashedPassword].deadline, "Deadline Not Reached To Claim Back the funds");

        uint256 valueSend = remittances[_hashedPassword].valueSend;
        require(valueSend != 0, "funds already claimed");
        remittances[_hashedPassword].valueSend = 0;
        remittances[_hashedPassword].fundSender = address(0);

        emit LogGetFunds(msg.sender, valueSend, _hashedPassword);
        (bool success, ) = msg.sender.call.value(valueSend)("");
        require(success, "Transfer Failed");

        return true;

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

    function generateHash(uint256 _password,address _exchangeMgr) public view returns(bytes32)
    {

        return keccak256(abi.encodePacked(_password, _exchangeMgr, address(this)));

    }
}
