//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L1TokenFactory} from "../src/L1TokenFactory.sol";
import {L1Token} from "../src/L1Token.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployL1TokenFactory is Script {
    function run() external {
        address owner = msg.sender;
        console.log("Deploying L1TokenFactory with owner:", owner);

        vm.startBroadcast();

        // Deploy token implementation
        L1Token tokenImplementation = new L1Token();
        console.log("L1Token implementation deployed at:", address(tokenImplementation));

        // Deploy factory implementation
        L1TokenFactory factoryImplementation = new L1TokenFactory();

        // Deploy factory proxy and initialize with owner and token implementation
        bytes memory initData = abi.encodeWithSelector(
            L1TokenFactory.initialize.selector,
            owner,
            address(tokenImplementation)
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(factoryImplementation),
            initData
        );

        vm.stopBroadcast();

        console.log("L1TokenFactory proxy deployed at:", address(proxy));
        console.log("L1TokenFactory implementation at:", address(factoryImplementation));
    }
}
