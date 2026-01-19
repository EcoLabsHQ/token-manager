// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";

contract DeploySalted is Script {
    bytes32 private constant SALT = keccak256("your_unique_salt");

    function run() external {
        vm.startBroadcast();

        L2SuperChainTokenFactory factory = new L2SuperChainTokenFactory();
        address tokenAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(factory),
            SALT,
            keccak256(type(L2SuperChainToken).creationCode)
        )))));

        console.log("L2SuperChainTokenFactory deployed at:", address(factory));
        console.log("L2SuperChainToken will be deployed at:", tokenAddress);

        vm.stopBroadcast();
    }
}