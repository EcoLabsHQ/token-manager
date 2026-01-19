//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";

contract DeployL2SuperChainTokenFactory is Script {
    /// @dev Salt constante para CREATE2 - garantiza la misma dirección en todas las cadenas
    /// @dev Constant salt for CREATE2 - ensures the same address across all chains
    bytes32 private constant DEPLOY_SALT =
        keccak256("celopg.l2.superchain.token.factory.v2");

    function run() external {
        vm.startBroadcast();

        L2SuperChainTokenFactory factory = new L2SuperChainTokenFactory{
            salt: DEPLOY_SALT
        }();

        vm.stopBroadcast();

        console.log("L2SuperChainTokenFactory deployed at:", address(factory));
        console.log("Deploy salt used:", vm.toString(DEPLOY_SALT));
    }
}
