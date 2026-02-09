//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title IToken
 * @dev Interface for token contracts (L1Token and L2SuperChainToken)
 */
interface IToken {
    // ============================================
    //         ERRORS
    // ============================================

    error ZeroAddress();
    error ExceedsMaxSupply();
    error NewMaxSupplyTooLow();
    error NoPendingOwnershipTransfer();
    error OnlyOwner();

    // ============================================
    //         EVENTS
    // ============================================

    event MaxSupplyUpdated(uint256 newMaxSupply);

    // ============================================
    //         STORAGE GETTERS
    // ============================================

    function maxSupply() external view returns (uint256);

    function decimals() external view returns (uint8);

    // ============================================
    //         PAUSE FUNCTIONS
    // ============================================

    function pause() external;

    function unpause() external;

    // ============================================
    //         BEHAVIOR FUNCTIONS
    // ============================================

    function mint(address to_, uint256 amount_) external;

    function burn(address from_, uint256 amount_) external;

    function setMaxSupply(uint256 newMaxSupply) external;

    // ============================================
    //         ERC165
    // ============================================

    /// @notice Checks if the contract supports a given interface
    /// @param interfaceId The interface identifier to check
    /// @return True if the interface is supported
    function supportsInterface(bytes4 interfaceId) external pure returns (bool);
}
