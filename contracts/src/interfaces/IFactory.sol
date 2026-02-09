//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title IFactory
 * @dev Interface for factory contracts (L1TokenFactory and L2SuperChainTokenFactory)
 */
interface IFactory {
    // ============================================
    //         CUSTOM ERRORS
    // ============================================
    error ZeroAddress();
    error MaxSupplyMustBeGreaterThanZero();
    error InitialSupplyExceedsMaxSupply();
    error InsufficientFee();
    error FeeTransferFailed();
    error RefundFailed();
    error PromoNonceAlreadyUsed();
    error PromoCodeExpired();
    error InvalidPromoSignature();
    error IndexOutOfBounds();

    // ============================================
    //         EVENTS
    // ============================================

    /// @dev Event emitted when a new token is created
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

    /// @dev Event emitted when the promo signer is updated
    event PromoSignerUpdated(address indexed newSigner);

    /// @dev Event emitted when a promo code is used
    event PromoCodeUsed(
        address indexed user,
        bytes32 indexed promoCodeHash,
        uint256 discountedFee
    );

    // ============================================
    //         STORAGE GETTERS
    // ============================================

    /// @notice Returns the implementation address used for new tokens
    function implementation() external view returns (address);

    /// @notice Returns the creation fee in wei
    function creationFee() external view returns (uint256);

    /// @notice Returns the fee recipient address
    function feeRecipient() external view returns (address);

    /// @notice Returns the promo signer address
    function promoSigner() external view returns (address);

    /// @notice Checks if a promo nonce has been used
    /// @param nonce The promo nonce to check
    /// @return True if the nonce has been used
    function isPromoNonceUsed(bytes32 nonce) external view returns (bool);

    /// @notice Returns the token address at a specific index
    /// @param index The index of the token
    /// @return The address of the token
    function allTokens(uint256 index) external view returns (address);

    /// @notice Checks if a token was created by this factory
    /// @param token The token address to check
    /// @return True if the token was created by this factory
    function isTokenFromFactory(address token) external view returns (bool);

    /// @notice Gets the total number of created tokens
    /// @return The total count of tokens
    function getAllTokensCount() external view returns (uint256);

    /// @notice Gets tokens with pagination
    /// @param offset The starting index
    /// @param limit The maximum number of tokens to return
    /// @return tokens Array of token addresses
    function getTokensPaginated(uint256 offset, uint256 limit) external view returns (address[] memory tokens);

    /// @notice Gets a token at a specific index
    /// @param index The index of the token
    /// @return The address of the token
    function getToken(uint256 index) external view returns (address);

    // ============================================
    //         ADMIN FUNCTIONS
    // ============================================

    /// @notice Sets the creation fee
    /// @param _fee The new creation fee in wei
    function setCreationFee(uint256 _fee) external;

    /// @notice Sets the fee recipient address
    /// @param _recipient The new fee recipient address
    function setFeeRecipient(address _recipient) external;

    /// @notice Sets the promo signer address
    /// @param _signer The new promo signer address
    function setPromoSigner(address _signer) external;

    // ============================================
    //         TOKEN CREATION FUNCTIONS
    // ============================================

    function createToken(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        bytes memory salt_
    ) external payable returns (address tokenAddress);

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
    ) external payable returns (address tokenAddress);
}
