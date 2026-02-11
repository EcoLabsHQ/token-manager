//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L2SuperChainToken} from "./L2SuperChainToken.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BaseTokenFactory} from "./BaseTokenFactory.sol";
import {TokenInitializer} from "./TokenInitializer.sol";

/**
 * @title L2SuperChainTokenFactory
 * @dev Factory contract to create instances of L2SuperChainToken (upgradeable) on Celo L2
 */
contract L2SuperChainTokenFactory is BaseTokenFactory {
    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l2_superchain_token_factory_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L2_SUPERCHAIN_TOKEN_FACTORY_STORAGE_LOCATION =
        0x5b8963702b04d03b695724c1c6fb65c92b4d922e4dae1b2ac498950a29e41300;

    function _getFactoryStorage()
        internal
        pure
        override
        returns (BaseFactoryStorage storage $)
    {
        assembly {
            $.slot := L2_SUPERCHAIN_TOKEN_FACTORY_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _implementation,
        address _tokenInitializer
    ) public initializer {
        __BaseTokenFactory_init(_owner, _implementation, _tokenInitializer);
    }

    // ============================================
    //         TOKEN CREATION
    // ============================================

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
            address(0),
            address(0),
            salt_
        );
    }

    /**
     * @dev Creates a new L2SuperChainToken with bridge configuration (NO FEE)
     * This is used when creating a token as part of an L1-L2 bridge setup
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply for the token
     * @param bridge_ Address of the bridge contract
     * @param remoteToken_ Address of the remote token on L1
     * @param salt_ Salt for deterministic deployment
     * @return tokenAddress The address of the newly created token proxy
     */
    function createTokenWithBridge(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        address bridge_,
        address remoteToken_,
        bytes memory salt_
    ) external nonReentrant returns (address tokenAddress) {
        _validateTokenParams(owner_, initialSupply_, maxSupply_);
        if (bridge_ == address(0)) revert ZeroAddress();
        if (remoteToken_ == address(0)) revert ZeroAddress();

        // NO FEE charged when bridge and remoteToken are provided

        tokenAddress = _deployToken(
            owner_,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_,
            bridge_,
            remoteToken_,
            salt_
        );
    }

    /**
     * @dev Creates a new L2SuperChainToken with a promotional fee
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param initialSupply_ Initial supply of the token (minted to owner)
     * @param maxSupply_ Maximum supply for the token
     * @param salt_ Salt for deterministic deployment
     * @param promoFee_ The promotional fee amount
     * @param promoNonce_ Unique nonce for this promo code usage
     * @param expiresAt_ Timestamp when the promo expires
     * @param signature_ Signature from the promo signer
     * @return tokenAddress The address of the newly created token proxy
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
            address(0),
            address(0),
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
        address bridge_,
        address remoteToken_,
        bytes memory salt_
    ) internal returns (address tokenAddress) {
        BaseFactoryStorage storage $ = _getFactoryStorage();

        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner_,
            name_,
            symbol_,
            decimals_,
            initialSupply_,
            maxSupply_,
            bridge_,
            remoteToken_
        );

        bytes32 salt = keccak256(salt_);

        // Deploy proxy pointing to TokenInitializer (deterministic address)
        tokenAddress = address(
            new ERC1967Proxy{salt: salt}($.tokenInitializer, "")
        );

        // Upgrade to real implementation and initialize in the same tx
        TokenInitializer(tokenAddress).upgradeToToken($.implementation, initData);

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
