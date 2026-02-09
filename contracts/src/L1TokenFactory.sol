//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L1Token} from "./L1Token.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
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
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFactory} from "./interfaces/IFactory.sol";

/**
 * @title L1TokenFactory
 * @dev Factory contract to create instances of L1Token on Ethereum L1
 */
contract L1TokenFactory is
    IFactory,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard
{

    struct L1TokenFactoryStorage {
        address[] allTokens;
        mapping(address => bool) isTokenFromFactory;
        address implementation;
        uint256 creationFee;
        address feeRecipient;
        address promoSigner;
        mapping(bytes32 => bool) usedPromoNonces;
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

    function initialize(
        address _owner,
        address _implementation
    ) public initializer {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        require(
            _implementation != address(0),
            "Implementation cannot be zero address"
        );
        $.implementation = _implementation;
        $.creationFee = 0;
        $.feeRecipient = _owner;
        $.promoSigner = _owner;
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

    function creationFee() external view returns (uint256) {
        return _getL1TokenFactoryStorage().creationFee;
    }

    function feeRecipient() external view returns (address) {
        return _getL1TokenFactoryStorage().feeRecipient;
    }

    function promoSigner() external view returns (address) {
        return _getL1TokenFactoryStorage().promoSigner;
    }

    function isPromoNonceUsed(bytes32 nonce) external view returns (bool) {
        return _getL1TokenFactoryStorage().usedPromoNonces[nonce];
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
     * @dev Sets the promo signer address
     * @param _signer The new promo signer address
     */
    function setPromoSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Signer cannot be zero address");
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();
        $.promoSigner = _signer;
        emit PromoSignerUpdated(_signer);
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
        address owner_,
        bytes memory salt_
    ) external payable nonReentrant returns (address tokenAddress) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();

        // Checks
        require(owner_ != address(0), "Owner cannot be zero address");
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        require(
            initialSupply_ <= maxSupply_,
            "Initial supply cannot exceed max supply"
        );
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

        bytes32 salt = keccak256(salt_);

        tokenAddress = address(
            new ERC1967Proxy{salt: salt}($.implementation, initData)
        );
        $.allTokens.push(tokenAddress);
        $.isTokenFromFactory[tokenAddress] = true;
        emit TokenCreated(
            tokenAddress,
            name_,
            symbol_,
            initialSupply_,
            maxSupply_,
            decimals_,
            owner_
        );

        // Interactions - External calls last (CEI pattern)
        if (feeAmount > 0 && recipient != address(0)) {
            (bool success, ) = recipient.call{value: feeAmount}("");
            require(success, "Fee transfer failed");
        }

        if (refundAmount > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }

        return tokenAddress;
    }

    /**
     * @dev Creates a new L1Token with a promotional fee
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply of the token
     * @param decimals_ Number of decimals for the token
     * @param owner_ Address of the token owner
     * @param promoFee_ The promotional fee amount
     * @param promoNonce_ Unique nonce for this promo code usage
     * @param expiresAt_ Timestamp when the promo expires
     * @param signature_ Signature from the promo signer
     * @return tokenAddress The address of the newly created token
     */
    function createTokenWithPromo(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        bytes memory salt_,
        uint256 promoFee_,
        bytes32 promoNonce_,
        uint256 expiresAt_,
        bytes memory signature_
    ) external payable nonReentrant returns (address tokenAddress) {
        L1TokenFactoryStorage storage $ = _getL1TokenFactoryStorage();

        // Verify promo signature
        require(!$.usedPromoNonces[promoNonce_], "Promo nonce already used");
        require(block.timestamp <= expiresAt_, "Promo code expired");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                promoFee_,
                promoNonce_,
                expiresAt_,
                block.chainid,
                address(this)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );
        address recoveredSigner = ECDSA.recover(ethSignedHash, signature_);
        require(recoveredSigner == $.promoSigner, "Invalid promo signature");

        // Mark nonce as used
        $.usedPromoNonces[promoNonce_] = true;

        // Checks
        require(owner_ != address(0), "Owner cannot be zero address");
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        require(
            initialSupply_ <= maxSupply_,
            "Initial supply cannot exceed max supply"
        );
        require(msg.value >= promoFee_, "Insufficient fee");

        // Cache fee values before state changes
        uint256 feeAmount = promoFee_;
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

        bytes32 salt = keccak256(salt_);

        tokenAddress = address(
            new ERC1967Proxy{salt: salt}($.implementation, initData)
        );

        $.allTokens.push(tokenAddress);
        $.isTokenFromFactory[tokenAddress] = true;

        emit TokenCreated(
            tokenAddress,
            name_,
            symbol_,
            initialSupply_,
            maxSupply_,
            decimals_,
            owner_
        );
        emit PromoCodeUsed(msg.sender, promoNonce_, promoFee_);

        // Interactions - External calls last (CEI pattern)
        if (feeAmount > 0 && recipient != address(0)) {
            (bool success, ) = recipient.call{value: feeAmount}("");
            require(success, "Fee transfer failed");
        }

        if (refundAmount > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }

        return tokenAddress;
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
