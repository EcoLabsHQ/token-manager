//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

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
import {TokenInitializer} from "./TokenInitializer.sol";

/**
 * @title BaseTokenFactory
 * @dev Abstract base contract for token factories with common functionality
 */
abstract contract BaseTokenFactory is
    IFactory,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard
{
    // ============================================
    //         STORAGE
    // ============================================

    struct BaseFactoryStorage {
        address[] allTokens;
        mapping(address => bool) isTokenFromFactory;
        address implementation;
        address tokenInitializer; // Placeholder for deterministic token deployment
        uint256 creationFee;
        address feeRecipient;
        address promoSigner;
        mapping(bytes32 => bool) usedPromoNonces;
    }

    /// @dev Override in child contracts to return the correct storage location
    function _getFactoryStorage() internal pure virtual returns (BaseFactoryStorage storage);

    // ============================================
    //         INITIALIZATION
    // ============================================

    function __BaseTokenFactory_init(
        address _owner,
        address _implementation,
        address _tokenInitializer
    ) internal onlyInitializing {
        BaseFactoryStorage storage $ = _getFactoryStorage();
        if (_implementation == address(0)) revert ZeroAddress();
        if (_tokenInitializer == address(0)) revert ZeroAddress();
        $.implementation = _implementation;
        $.tokenInitializer = _tokenInitializer;
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
        return _getFactoryStorage().implementation;
    }

    function tokenInitializer() external view returns (address) {
        return _getFactoryStorage().tokenInitializer;
    }

    function creationFee() external view returns (uint256) {
        return _getFactoryStorage().creationFee;
    }

    function feeRecipient() external view returns (address) {
        return _getFactoryStorage().feeRecipient;
    }

    function promoSigner() external view returns (address) {
        return _getFactoryStorage().promoSigner;
    }

    function isPromoNonceUsed(bytes32 nonce) external view returns (bool) {
        return _getFactoryStorage().usedPromoNonces[nonce];
    }

    function allTokens(uint256 index) external view returns (address) {
        return _getFactoryStorage().allTokens[index];
    }

    function isTokenFromFactory(address token) external view returns (bool) {
        return _getFactoryStorage().isTokenFromFactory[token];
    }

    function getAllTokensCount() external view returns (uint256) {
        return _getFactoryStorage().allTokens.length;
    }

    function getTokensPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory tokens) {
        BaseFactoryStorage storage $ = _getFactoryStorage();
        uint256 total = $.allTokens.length;

        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = $.allTokens[i];
        }
    }

    function getToken(uint256 index) external view returns (address) {
        BaseFactoryStorage storage $ = _getFactoryStorage();
        if (index >= $.allTokens.length) revert IndexOutOfBounds();
        return $.allTokens[index];
    }

    // ============================================
    //         ADMIN FUNCTIONS
    // ============================================

    function setCreationFee(uint256 _fee) external onlyOwner {
        BaseFactoryStorage storage $ = _getFactoryStorage();
        $.creationFee = _fee;
        emit CreationFeeUpdated(_fee);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        BaseFactoryStorage storage $ = _getFactoryStorage();
        $.feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function setPromoSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        BaseFactoryStorage storage $ = _getFactoryStorage();
        $.promoSigner = _signer;
        emit PromoSignerUpdated(_signer);
    }

    // ============================================
    //         INTERNAL HELPERS
    // ============================================

    function _validateTokenParams(
        address owner_,
        uint256 initialSupply_,
        uint256 maxSupply_
    ) internal pure {
        if (owner_ == address(0)) revert ZeroAddress();
        if (maxSupply_ == 0) revert MaxSupplyMustBeGreaterThanZero();
        if (initialSupply_ > maxSupply_) revert InitialSupplyExceedsMaxSupply();
    }

    function _validateAndUsePromo(
        uint256 promoFee_,
        bytes32 promoNonce_,
        uint256 expiresAt_,
        bytes memory signature_
    ) internal {
        BaseFactoryStorage storage $ = _getFactoryStorage();

        if ($.usedPromoNonces[promoNonce_]) revert PromoNonceAlreadyUsed();
        if (block.timestamp > expiresAt_) revert PromoCodeExpired();

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
        if (recoveredSigner != $.promoSigner) revert InvalidPromoSignature();

        $.usedPromoNonces[promoNonce_] = true;
    }

    function _handleFees(uint256 feeAmount, address recipient) internal {
        uint256 refundAmount = msg.value - feeAmount;

        if (feeAmount > 0 && recipient != address(0)) {
            (bool success, ) = recipient.call{value: feeAmount}("");
            if (!success) revert FeeTransferFailed();
        }

        if (refundAmount > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: refundAmount}("");
            if (!refundSuccess) revert RefundFailed();
        }
    }

    function _registerToken(address tokenAddress) internal {
        BaseFactoryStorage storage $ = _getFactoryStorage();
        $.allTokens.push(tokenAddress);
        $.isTokenFromFactory[tokenAddress] = true;
    }
}
