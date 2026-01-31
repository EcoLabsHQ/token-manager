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
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title L1TokenFactory
 * @dev Factory contract to create instances of L1Token on Ethereum L1
 */
contract L1TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    /// @dev Event emitted when a new L1Token is created
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 maxSupply,
        uint8 decimals,
        address indexed owner
    );

    /// @dev Event emitted when the creation fee is updated
    event CreationFeeUpdated(uint256 newFee);
    /// @dev Event emitted when the fee recipient is updated
    event FeeRecipientUpdated(address indexed newRecipient);

    struct L1TokenFactoryStorage {
        address[] allTokens;
        mapping(address => bool) isTokenFromFactory;
        address implementation;
        uint256 creationFee;
        address feeRecipient;
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

    function initialize(address _owner, address _implementation) public initializer {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        require(_implementation != address(0), "Implementation cannot be zero address");
        $.implementation = _implementation;
        $.creationFee = 0;
        $.feeRecipient = _owner;
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
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

    function creationFee() external view returns (uint256) {
        return _getL1TokenFactoryStorage().creationFee;
    }

    function feeRecipient() external view returns (address) {
        return _getL1TokenFactoryStorage().feeRecipient;
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
     * @dev Sets the creation fee
     * @param _fee The new creation fee in wei
     */
    function setCreationFee(uint256 _fee) external onlyOwner {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        $.creationFee = _fee;
        emit CreationFeeUpdated(_fee);
    }

    /**
     * @dev Sets the fee recipient address
     * @param _recipient The new fee recipient address
     */
    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Recipient cannot be zero address");
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        $.feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    /**
     * @dev Creates a new L1Token
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply of the token
     * @param decimals_ Number of decimals for the token
     * @param owner_ Address of the token owner
     * @return tokenAddress The address of the newly created token
     */
    function createToken(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        uint8 decimals_,
        address owner_
    ) external payable nonReentrant returns (address tokenAddress) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        
        // Checks
        require(owner_ != address(0), "Owner cannot be zero address");
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        require(initialSupply_ <= maxSupply_, "Initial supply cannot exceed max supply");
        require(msg.value >= $.creationFee, "Insufficient fee");

        // Cache fee values before state changes
        uint256 feeAmount = $.creationFee;
        address recipient = $.feeRecipient;
        uint256 refundAmount = msg.value - feeAmount;

        // Effects - Create token and update state first
        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            name_,
            symbol_,
            initialSupply_,
            maxSupply_,
            decimals_,
            owner_
        );

        address newToken = address(
            new ERC1967Proxy($.implementation, initData)
        );

        $.allTokens.push(newToken);
        $.isTokenFromFactory[newToken] = true;

        emit TokenCreated(newToken, name_, symbol_, initialSupply_, maxSupply_, decimals_, owner_);

        // Interactions - External calls last (CEI pattern)
        if (feeAmount > 0 && recipient != address(0)) {
            (bool success, ) = recipient.call{value: feeAmount}("");
            require(success, "Fee transfer failed");
        }

        if (refundAmount > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }

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
