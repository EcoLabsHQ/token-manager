//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title DeploySalts
 * @notice Shared salt constants for deterministic deployment across chains
 * @dev These salts ensure that:
 *      1. FactoryInitializer has the same address on all chains
 *      2. Factory proxy has the same address on all chains
 *      3. TokenInitializer has the same address on all chains
 *      4. Token proxies created with same salt have the same address on all chains
 */
library DeploySalts {
    /// @dev Salt for FactoryInitializer placeholder - MUST be identical on all chains
    bytes32 internal constant INITIALIZER_SALT =
        keccak256("ecolabs.factory.initializer.v1");

    /// @dev Salt for factory proxy - MUST be identical on all chains
    bytes32 internal constant FACTORY_PROXY_SALT =
        keccak256("ecolabs.factory.proxy.v1");

    /// @dev Salt for TokenInitializer - MUST be identical on all chains
    bytes32 internal constant TOKEN_INITIALIZER_SALT =
        keccak256("ecolabs.token.initializer.v1");
}
