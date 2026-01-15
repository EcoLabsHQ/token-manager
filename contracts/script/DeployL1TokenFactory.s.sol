//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L1TokenFactory} from "../src/L1TokenFactory.sol";

contract DeployL1TokenFactory is Script {
    function run() external {
        vm.startBroadcast();

        L1TokenFactory factory = new L1TokenFactory();

        vm.stopBroadcast();

        console.log("L1TokenFactory deployed at:", address(factory));
    }
}
