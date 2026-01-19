// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L2SuperChainToken} from "./L2SuperChainToken.sol";

contract L2SuperChainTokenFactory {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function deployToken(string memory name, string memory symbol, bytes32 salt) external returns (address) {
        require(msg.sender == owner, "Only owner can deploy tokens");

        L2SuperChainToken token = new L2SuperChainToken{salt: salt}(name, symbol);
        return address(token);
    }

    function computeAddress(bytes32 salt) external view returns (address) {
        bytes32 bytecodeHash = keccak256(type(L2SuperChainToken).creationCode);
        bytes32 finalHash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
        return address(uint160(uint256(finalHash)));
    }
}