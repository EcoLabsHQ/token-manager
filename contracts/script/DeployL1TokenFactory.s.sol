//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L1TokenFactory} from "../src/L1TokenFactory.sol";
import {L1Token} from "../src/L1Token.sol";
import {FactoryInitializer} from "../src/FactoryInitializer.sol";
import {TokenInitializer} from "../src/TokenInitializer.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DeploySalts} from "./libraries/DeploySalts.sol";

/**
 * @title DeployL1TokenFactory
 * @notice Deploys L1TokenFactory with deterministic proxy address (same as L2)
 * @dev Uses FactoryInitializer placeholder pattern:
 *      1. Deploy FactoryInitializer with CREATE2 → same address on all chains
 *      2. Deploy ERC1967Proxy with CREATE2 → same address on all chains
 *      3. Deploy TokenInitializer with CREATE2 → same address on all chains
 *      4. Upgrade to L1TokenFactory and initialize
 * 
 * Usage:
 *   FACTORY_OWNER=0x... forge script script/DeployL1TokenFactory.s.sol --rpc-url mainnet --broadcast
 */
contract DeployL1TokenFactory is Script {
    function run() external {
        address owner = vm.envOr("FACTORY_OWNER", msg.sender);
        
        console.log("========================================");
        console.log("Deploying L1TokenFactory");
        console.log("========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Owner:", owner);
        console.log("Deployer:", msg.sender);
        console.log("");

        vm.startBroadcast();

        // Step 1: Deploy FactoryInitializer with CREATE2 (same address on all chains)
        FactoryInitializer factoryInitializer = new FactoryInitializer{salt: DeploySalts.INITIALIZER_SALT}();
        console.log("FactoryInitializer:", address(factoryInitializer));

        // Step 2: Deploy factory proxy with CREATE2 (same address on all chains)
        ERC1967Proxy proxy = new ERC1967Proxy{salt: DeploySalts.FACTORY_PROXY_SALT}(
            address(factoryInitializer),
            "" // No init data yet
        );
        console.log("Factory Proxy:", address(proxy));

        // Step 3: Deploy TokenInitializer with CREATE2, authorized only for the factory
        // SECURITY: Only the factory can call upgradeToToken, preventing front-running
        TokenInitializer tokenInitializer = new TokenInitializer{salt: DeploySalts.TOKEN_INITIALIZER_SALT}(address(proxy));
        console.log("TokenInitializer:", address(tokenInitializer));

        // Step 4: Deploy L1-specific implementations
        L1Token tokenImpl = new L1Token();
        console.log("L1Token implementation:", address(tokenImpl));

        L1TokenFactory factoryImpl = new L1TokenFactory();
        console.log("L1TokenFactory implementation:", address(factoryImpl));

        // Step 5: Upgrade proxy to L1TokenFactory and initialize
        bytes memory initData = abi.encodeWithSelector(
            L1TokenFactory.initialize.selector,
            owner,
            address(tokenImpl),
            address(tokenInitializer)
        );
        FactoryInitializer(address(proxy)).upgradeToFactory(address(factoryImpl), initData);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("L1TokenFactory deployed successfully!");
        console.log("========================================");
        console.log("Factory Proxy (use this):", address(proxy));
        console.log("This address is the SAME on L2 (Celo)");
        console.log("Tokens created with same salt will have SAME address on both chains");
        console.log("========================================");
    }
}
