//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";

contract DeployL2SuperChainTokenFactory is Script {
    function run() external {
        vm.startBroadcast();

        L2SuperChainTokenFactory factory = new L2SuperChainTokenFactory();

        vm.stopBroadcast();

        console.log("L2SuperChainTokenFactory deployed at:", address(factory));
    }
}
