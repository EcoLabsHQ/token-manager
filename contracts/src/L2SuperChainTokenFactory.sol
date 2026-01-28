//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L2SuperChainToken} from "./L2SuperChainToken.sol";
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
 * @title L2SuperChainTokenFactory
 * @dev Factory contract to create instances of L2SuperChainToken (upgradeable) on Celo L2
 */
contract L2SuperChainTokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// @dev Event emitted when a new token is created
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint8 decimals,
        uint256 initialSupply,
        uint256 maxSupply,
        address indexed owner
    );

    struct L2SuperChainTokenFactoryStorage {
        address[] allTokens;
        mapping(address => bool) isTokenFromFactory;
        address implementation;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l2_superchain_token_factory_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L2_SUPERCHAIN_TOKEN_FACTORY_STORAGE_LOCATION =
        0x5b8963702b04d03b695724c1c6fb65c92b4d922e4dae1b2ac498950a29e41300;

    function _getL2SuperChainTokenFactoryStorage()
        private
        pure
        returns (L2SuperChainTokenFactoryStorage storage $)
    {
        assembly {
            $.slot := L2_SUPERCHAIN_TOKEN_FACTORY_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _implementation) public initializer {
        L2SuperChainTokenFactoryStorage storage $ = _getL2SuperChainTokenFactoryStorage();
        require(_implementation != address(0), "Implementation cannot be zero address");
        $.implementation = _implementation;
        __Ownable_init(_owner);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ============================================
    //         STORAGE GETTERS
    // ============================================

    function implementation() external view returns (address) {
        return _getL2SuperChainTokenFactoryStorage().implementation;
    }

    function allTokens(uint256 index) external view returns (address) {
        return _getL2SuperChainTokenFactoryStorage().allTokens[index];
    }

    function isTokenFromFactory(address token) external view returns (bool) {
        return _getL2SuperChainTokenFactoryStorage().isTokenFromFactory[token];
    }

    /// @dev Gets the total number of created tokens
    function getAllTokensCount() external view returns (uint256) {
        L2SuperChainTokenFactoryStorage storage $ = _getL2SuperChainTokenFactoryStorage();
        return $.allTokens.length;
    }

    /// @dev Gets all created tokens
    function getAllTokens() external view returns (address[] memory) {
        L2SuperChainTokenFactoryStorage storage $ = _getL2SuperChainTokenFactoryStorage();
        return $.allTokens;
    }

    /**
     * @dev Creates a new L2SuperChainToken (upgradeable proxy)
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply for the token
     * @param salt_ Salt for deterministic deployment
     * @return tokenAddress The address of the newly created token proxy
     */
    function createToken(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        bytes memory salt_
    ) external returns (address tokenAddress) {
        L2SuperChainTokenFactoryStorage storage $ = _getL2SuperChainTokenFactoryStorage();
        require(owner_ != address(0), "Owner cannot be zero address");
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        require(initialSupply_ <= maxSupply_, "Initial supply cannot exceed max supply");

        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner_,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_
        );

        bytes32 salt = keccak256(salt_);

        tokenAddress = address(
            new ERC1967Proxy{salt: salt}($.implementation, initData)
        );

        // Register the token
        $.allTokens.push(tokenAddress);
        $.isTokenFromFactory[tokenAddress] = true;

        // Emit event
        emit TokenCreated(
            tokenAddress,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_,
            owner_
        );

        return tokenAddress;
    }

    /**
     * @dev Gets a token at a specific index
     * @param index The index of the token
     * @return The address of the token
     */
    function getToken(uint256 index) external view returns (address) {
        L2SuperChainTokenFactoryStorage storage $ = _getL2SuperChainTokenFactoryStorage();
        require(index < $.allTokens.length, "Index out of bounds");
        return $.allTokens[index];
    }
}
