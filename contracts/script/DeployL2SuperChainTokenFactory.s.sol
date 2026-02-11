//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console} from "forge-std/Script.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {FactoryInitializer} from "../src/FactoryInitializer.sol";
import {TokenInitializer} from "../src/TokenInitializer.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DeploySalts} from "./libraries/DeploySalts.sol";

/**
 * @title DeployL2SuperChainTokenFactory
 * @notice Deploys L2SuperChainTokenFactory with deterministic proxy address (same as L1)
 * @dev Uses FactoryInitializer placeholder pattern:
 *      1. Deploy FactoryInitializer with CREATE2 → same address on all chains
 *      2. Deploy ERC1967Proxy with CREATE2 → same address on all chains
 *      3. Deploy TokenInitializer with CREATE2 → same address on all chains
 *      4. Upgrade to L2SuperChainTokenFactory and initialize
 * 
 * Usage:
 *   FACTORY_OWNER=0x... forge script script/DeployL2SuperChainTokenFactory.s.sol --rpc-url celo --broadcast
 */
contract DeployL2SuperChainTokenFactory is Script {
    function run() external {
        address owner = vm.envOr("FACTORY_OWNER", msg.sender);
        
        console.log("========================================");
        console.log("Deploying L2SuperChainTokenFactory");
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

        // Step 4: Deploy L2-specific implementations
        L2SuperChainToken tokenImpl = new L2SuperChainToken();
        console.log("L2SuperChainToken implementation:", address(tokenImpl));

        L2SuperChainTokenFactory factoryImpl = new L2SuperChainTokenFactory();
        console.log("L2SuperChainTokenFactory implementation:", address(factoryImpl));

        // Step 5: Upgrade proxy to L2SuperChainTokenFactory and initialize
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainTokenFactory.initialize.selector,
            owner,
            address(tokenImpl),
            address(tokenInitializer)
        );
        FactoryInitializer(address(proxy)).upgradeToFactory(address(factoryImpl), initData);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("L2SuperChainTokenFactory deployed successfully!");
        console.log("========================================");
        console.log("Factory Proxy (use this):", address(proxy));
        console.log("This address is the SAME on L1 (Ethereum)");
        console.log("Tokens created with same salt will have SAME address on both chains");
        console.log("========================================");
    }
}
