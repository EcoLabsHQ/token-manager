//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployL2SuperChainTokenFactory is Script {
    /// @dev Salt for CREATE2 - ensures deterministic address across chains
    bytes32 private constant FACTORY_SALT =
        keccak256("l2.superchain.token.factory.v1");

    function run() external {
        address owner = msg.sender;

        vm.startBroadcast();

        // Deploy token implementation (no salt needed)
        L2SuperChainToken tokenImplementation = new L2SuperChainToken();
        console.log("L2SuperChainToken implementation deployed at:", address(tokenImplementation));

        // Deploy factory implementation with salt
        L2SuperChainTokenFactory factoryImplementation = new L2SuperChainTokenFactory{salt: FACTORY_SALT}();

        // Deploy factory proxy with salt and initialize
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainTokenFactory.initialize.selector,
            owner,
            address(tokenImplementation)
        );

        ERC1967Proxy proxy = new ERC1967Proxy{salt: FACTORY_SALT}(
            address(factoryImplementation),
            initData
        );

        vm.stopBroadcast();

        console.log("L2SuperChainTokenFactory proxy deployed at:", address(proxy));
        console.log("L2SuperChainTokenFactory implementation at:", address(factoryImplementation));
        console.log("Deploy salt used:", vm.toString(FACTORY_SALT));
    }
}
