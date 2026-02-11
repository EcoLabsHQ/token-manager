//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title TokenInitializer
 * @notice Placeholder implementation for deterministic token deployment across chains
 * @dev This contract serves as a temporary implementation that allows:
 *      1. Deploying token proxies with identical bytecode across all chains
 *      2. Upgrading to the real token implementation (L1Token or L2SuperChainToken) in the same tx
 * 
 * SECURITY: Only the authorized factory can call upgradeToToken to prevent front-running attacks.
 * The factory address is set at deployment and is immutable.
 * 
 * The flow (all in one transaction):
 *   1. Factory deploys ERC1967Proxy(TokenInitializer, "") with CREATE2 → same address on all chains
 *   2. Factory calls proxy.upgradeToToken(realImplementation, initData) → upgrades to L1/L2 token
 * 
 * This contract MUST be deployed with CREATE2 using the same salt on all chains
 * to ensure identical addresses.
 */
contract TokenInitializer is Initializable, UUPSUpgradeable {
    /// @dev The factory address that is authorized to call upgradeToToken
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable factory;

    /// @dev Flag to track if this placeholder has been upgraded
    bool private _upgraded;

    error AlreadyUpgraded();
    error OnlyFactory();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _factory) {
        if (_factory == address(0)) revert OnlyFactory();
        factory = _factory;
        _disableInitializers();
    }

    /**
     * @notice Upgrades the proxy to the real token implementation
     * @dev Can only be called once by the factory, typically in the same tx as proxy deployment
     * @param newImplementation Address of the real token (L1Token or L2SuperChainToken)
     * @param data Initialization data for the token
     */
    function upgradeToToken(
        address newImplementation,
        bytes calldata data
    ) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (_upgraded) revert AlreadyUpgraded();
        _upgraded = true;
        
        // This will upgrade and call initialize on the new implementation
        upgradeToAndCall(newImplementation, data);
    }

    /**
     * @dev Required by UUPS - allows upgrade only through upgradeToToken
     */
    function _authorizeUpgrade(address) internal pure override {
        // Authorization is handled by the factory check in upgradeToToken
    }
}
