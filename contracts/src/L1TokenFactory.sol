//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L1Token} from "./L1Token.sol";

/**
 * @title L1TokenFactory
 * @dev Factory contract to create instances of L1Token on Ethereum L1
 */
contract L1TokenFactory {
    /// @dev Event emitted when a new L1Token is created
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        address indexed owner
    );

    /// @dev Array of all created tokens
    address[] public allTokens;

    /// @dev Mapping to track if an address is a token created by this factory
    mapping(address => bool) public isTokenFromFactory;

    /// @dev Gets the total number of created tokens
    function getAllTokensCount() external view returns (uint256) {
        return allTokens.length;
    }

    /// @dev Gets all created tokens
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
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
        require(owner_ != address(0), "Owner cannot be zero address");
        require(initialSupply_ > 0, "Initial supply must be greater than zero");

        L1Token newToken = new L1Token(
            name_,
            symbol_,
            initialSupply_,
            owner_
        );

        tokenAddress = address(newToken);
        allTokens.push(tokenAddress);
        isTokenFromFactory[tokenAddress] = true;

        emit TokenCreated(tokenAddress, name_, symbol_, initialSupply_, owner_);

        return tokenAddress;
    }

    /**
     * @dev Gets a token at a specific index
     * @param index The index of the token
     * @return The address of the token
     */
    function getToken(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }
}
