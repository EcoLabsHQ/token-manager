//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L1Token} from "./L1Token.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BaseTokenFactory} from "./BaseTokenFactory.sol";

/**
 * @title L1TokenFactory
 * @dev Factory contract to create instances of L1Token on Ethereum L1
 */
contract L1TokenFactory is BaseTokenFactory {
    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l1_token_factory_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L1_TOKEN_FACTORY_STORAGE_LOCATION =
        0x9d3bcf687c7b659a3c425db693cabd1999cc77999f515ece772c2b605813f700;

    function _getFactoryStorage()
        internal
        pure
        override
        returns (BaseFactoryStorage storage $)
    {
        assembly {
            $.slot := L1_TOKEN_FACTORY_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _implementation
    ) public initializer {
        __BaseTokenFactory_init(_owner, _implementation);
    }

    // ============================================
    //         TOKEN CREATION
    // ============================================

    /**
     * @dev Creates a new L1Token
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply of the token
     * @param salt_ Salt for deterministic deployment
     * @return tokenAddress The address of the newly created token
     */
    function createToken(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        bytes memory salt_
    ) external payable nonReentrant returns (address tokenAddress) {
        BaseFactoryStorage storage $ = _getFactoryStorage();

        _validateTokenParams(owner_, initialSupply_, maxSupply_);
        if (msg.value < $.creationFee) revert InsufficientFee();

        _handleFees($.creationFee, $.feeRecipient);

        tokenAddress = _deployToken(
            owner_,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_,
            salt_
        );
    }

    /**
     * @dev Creates a new L1Token with a promotional fee
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply of the token
     * @param salt_ Salt for deterministic deployment
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
        BaseFactoryStorage storage $ = _getFactoryStorage();

        _validateAndUsePromo(promoFee_, promoNonce_, expiresAt_, signature_);
        _validateTokenParams(owner_, initialSupply_, maxSupply_);
        if (msg.value < promoFee_) revert InsufficientFee();

        _handleFees(promoFee_, $.feeRecipient);

        tokenAddress = _deployToken(
            owner_,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_,
            salt_
        );

        emit PromoCodeUsed(msg.sender, promoNonce_, promoFee_);
    }

    // ============================================
    //         INTERNAL
    // ============================================

    function _deployToken(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        bytes memory salt_
    ) internal returns (address tokenAddress) {
        BaseFactoryStorage storage $ = _getFactoryStorage();

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

        _registerToken(tokenAddress);

        emit TokenCreated(
            tokenAddress,
            name_,
            symbol_,
            initialSupply_,
            maxSupply_,
            decimals_,
            owner_
        );
    }
}
