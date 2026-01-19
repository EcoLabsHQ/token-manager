// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";

contract DeployL2SuperChainTokenFactory is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy the L2SuperChainTokenFactory using create2
        L2SuperChainTokenFactory factory = new L2SuperChainTokenFactory();

        vm.stopBroadcast();

        console.log("L2SuperChainTokenFactory deployed at:", address(factory));
    }

    function _implSalt() internal view returns (bytes32) {
        string memory salt = vm.parseTomlString(
            deployConfig,
            ".deploy_config.salt"
        );
        return keccak256(abi.encodePacked(salt));
    }
}