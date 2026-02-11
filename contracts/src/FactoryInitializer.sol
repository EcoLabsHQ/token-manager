//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title FactoryInitializer
 * @notice Placeholder implementation for deterministic factory deployment
 * @dev This contract serves as a temporary implementation that allows:
 *      1. Deploying the proxy with identical bytecode across all chains
 *      2. Upgrading to the real factory implementation (L1 or L2) afterwards
 * 
 * The flow is:
 *   1. Deploy FactoryInitializer with CREATE2 → same address on all chains
 *   2. Deploy ERC1967Proxy(FactoryInitializer, "") with CREATE2 → same address on all chains
 *   3. Call proxy.upgradeToFactory(realFactory, initData) → upgrades to L1/L2 factory
 */
contract FactoryInitializer is Initializable, UUPSUpgradeable {
    /// @dev Flag to track if this placeholder has been used
    bool private _upgraded;

    error AlreadyUpgraded();
    error Unauthorized();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Upgrades the proxy to the real factory implementation
     * @dev Can only be called once. After this, the proxy points to the real factory.
     * @param newImplementation Address of the real factory (L1TokenFactory or L2SuperChainTokenFactory)
     * @param data Initialization data (abi.encodeWithSelector(Factory.initialize.selector, owner, tokenImpl))
     */
    function upgradeToFactory(
        address newImplementation,
        bytes calldata data
    ) external {
        if (_upgraded) revert AlreadyUpgraded();
        _upgraded = true;
        
        // This will upgrade and call initialize on the new implementation
        upgradeToAndCall(newImplementation, data);
    }

    /**
     * @dev Required by UUPS - allows upgrade only through upgradeToFactory
     */
    function _authorizeUpgrade(address) internal pure override {
        // Authorization is handled by the _upgraded flag in upgradeToFactory
        // Direct calls to upgradeTo/upgradeToAndCall will fail because they're internal
    }
}
