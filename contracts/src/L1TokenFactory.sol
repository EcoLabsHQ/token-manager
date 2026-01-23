//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L1Token} from "./L1Token.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title L1TokenFactory
 * @dev Factory contract to create instances of L1Token on Ethereum L1
 */
contract L1TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// @dev Event emitted when a new L1Token is created
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        address indexed owner
    );

    struct L1TokenFactoryStorage {
        address[] allTokens;
        mapping(address => bool) isTokenFromFactory;
        address implementation;
    }

    function _getL1TokenFactoryStorage()
        private
        pure
        returns (L1TokenFactoryStorage storage $)
    {
        assembly {
            $.slot := L1_TOKEN_FACTORY_STORAGE_LOCATION
        }
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l1_token_factory_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L1_TOKEN_FACTORY_STORAGE_LOCATION =
        0x9d3bcf687c7b659a3c425db693cabd1999cc77999f515ece772c2b605813f700;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        $.implementation = address(new L1Token());
        __Ownable_init(_owner);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ============================================
    //         STORAGE GETTERS
    // ============================================

    function implementation() external view returns (address) {
        return _getL1TokenFactoryStorage().implementation;
    }

    function allTokens(uint256 index) external view returns (address) {
        return _getL1TokenFactoryStorage().allTokens[index];
    }

    function isTokenFromFactory(address token) external view returns (bool) {
        return _getL1TokenFactoryStorage().isTokenFromFactory[token];
    }

    /// @dev Gets the total number of created tokens
    function getAllTokensCount() external view returns (uint256) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        return $.allTokens.length;
    }

    /// @dev Gets all created tokens
    function getAllTokens() external view returns (address[] memory) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        return $.allTokens;
    }

    /**
     * @dev Creates a new L1Token
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param initialSupply_ Initial supply of the token
     * @param owner_ Address of the token owner
     * @return tokenAddress The address of the newly created token
     */
    function createToken(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_
    ) external returns (address tokenAddress) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        require(owner_ != address(0), "Owner cannot be zero address");
        require(initialSupply_ > 0, "Initial supply must be greater than zero");

        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            name_,
            symbol_,
            initialSupply_,
            owner_
        );

        address newToken = address(
            new ERC1967Proxy($.implementation, initData)
        );

        $.allTokens.push(newToken);
        $.isTokenFromFactory[newToken] = true;

        emit TokenCreated(newToken, name_, symbol_, initialSupply_, owner_);

        return newToken;
    }

    /**
     * @dev Gets a token at a specific index
     * @param index The index of the token
     * @return The address of the token
     */
    function getToken(uint256 index) external view returns (address) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        require(index < $.allTokens.length, "Index out of bounds");
        return $.allTokens[index];
    }
}
