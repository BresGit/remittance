pragma solidity ^0.5.0;
import "./RemittanceVer2.sol";

contract RemittanceCreator {

    address[] public remittances;

    constructor() public
    {

    }

    event LogNewRemittance(address _Sender, address _Exchange, address _newRemittance);

    function newRemitt( address  _Exchange, address _Sender) public returns(address)
    {

       require(_Sender != address(0) &&  _Exchange != address(0), "Adress can't be zero");

       RemittanceVer2 newRemittance = new RemittanceVer2(_Exchange, _Sender);
       remittances.push(address(newRemittance));

       emit LogNewRemittance(_Sender,_Exchange, address(newRemittance));

       return address(newRemittance);
    }

}
