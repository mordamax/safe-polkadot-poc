// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract Storage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function setValue(uint256 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function getValue() public view returns (uint256) {
        return 42;
    }
}
