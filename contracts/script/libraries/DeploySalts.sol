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
 *
 *      The DEPLOYER address is included in salts to prevent front-running/squatting.
 */
library DeploySalts {
    /// @dev Authorized deployer address - included in all salts for anti-squatting
    address internal constant DEPLOYER = 0x1726cf86DA996BC4B2F393E713f6F8ef83f2e4f6;

    /// @dev Salt for FactoryInitializer placeholder - MUST be identical on all chains
    bytes32 internal constant INITIALIZER_SALT =
        keccak256(abi.encodePacked("ecolabs.factory.initializer.v5", DEPLOYER));

    /// @dev Salt for factory proxy - MUST be identical on all chains
    bytes32 internal constant FACTORY_PROXY_SALT =
        keccak256(abi.encodePacked("ecolabs.factory.proxy.v5", DEPLOYER));

    /// @dev Salt for TokenInitializer - MUST be identical on all chains
    bytes32 internal constant TOKEN_INITIALIZER_SALT =
        keccak256(abi.encodePacked("ecolabs.token.initializer.v5", DEPLOYER));
}
