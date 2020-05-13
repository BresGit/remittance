pragma solidity ^0.5.0;
contract Remittance
{

    //there are three people: Alice, Bob & Carol.
    //Alice wants to send funds to Bob, but she only has ether & Bob does not care about Ether and wants to be paid in local currency.
    //luckily, Carol runs an exchange shop that converts ether to local currency.

    address payable public alice;
    address public bob;
    address payable public carol;
    uint256 public startDeadline;
    bytes32 public PSW;

    event LogFundsTransfereToCarol(address sender,uint256 balance);
    event LogPSWAssigned(address sender,uint256 value);
    event LogWithdraw(address requester, uint256 value);
    event LogGetFunds(address requester, uint256 value);

    constructor (address payable _alice,address _bob, address payable _carol) public

    {

       require(_alice != address(0) && _bob != address(0) && _carol != address(0),"Adress can't be zero");

       alice = _alice;
       bob = _bob;
       carol = _carol;

    }

    // this will represent funds Alice needs to transfer
    //only Alice should be able to unlock the password
    // @PSW is the full hashed password - Keep in mind Alice has the full password, she will provide to Carol and Bob partial
    // passwords for the exchange to be completed
    function fundsToTransfer(bytes32 _PSW) public payable

    {

        require(msg.sender==alice, "Fund Sender must be Alice");
        require(msg.value > 0, "Value must be greater > 0");

        startDeadline = now; //now is solidity global variable
        PSW = _PSW; //the full hashed password
        emit LogPSWAssigned(msg.sender, msg.value);

    }

    // exchange is executed after Bob and Carol met and Bob provided his part of PSW to Carol, now the funds in ether can be released to Carol
    function exchange(string memory _bobPsw, string memory _carolPsw) public returns (bool)

    {

        uint funds = (address(this).balance);
        require(funds > 0);
        require(msg.sender==carol);
        require(PSW == keccak256(abi.encodePacked(_bobPsw, _carolPsw)), "Password Does Not Match");
        emit LogFundsTransfereToCarol(msg.sender, funds);

        (bool success, ) = msg.sender.call.value(funds)("");
        require(success, "TRansfer Failed");
        return true;

    }

    function withdraw() public

    {
        // this will allow Alice to claim the funds back after 4 weeks by killing the contract and receiving the funds
        require(startDeadline + 4 weeks < now, "Deadline not reached");

        if (alice == msg.sender)
        {

            emit LogWithdraw(msg.sender, address(this).balance);
            selfdestruct(alice);

        }
    }

        function getUnclaimedFunds() public
    {

        require(alice == msg.sender, "sender is not Alice");
        require(now > startDeadline + 365 days, "Deadline Not Reached");
        require(address(this).balance > 0, "No Balance to return");
        emit LogGetFunds(msg.sender, address(this).balance);
        (bool success, ) = alice.call.value(address(this).balance)("");
        require(success, "TRansfer Failed");

    }
}
