//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {L2SuperChainToken} from "./L2SuperChainToken.sol";

/**
 * @title L2SuperChainTokenFactory
 * @dev Factory contract to create instances of HighVelocityToken (SuperChainToken) on Celo L2
 */
contract L2SuperChainTokenFactory {
    /// @dev Event emitted when a new token is created
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint8 decimals,
        uint256 maxSupply,
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
     * @dev Creates a new HighVelocityToken (SuperChainToken)
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals for the token
     * @param maxSupply_ Maximum supply for the token
     * @return tokenAddress The address of the newly created token
     */
    function createToken(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxSupply_,
        bytes memory salt_
    ) external returns (address tokenAddress) {
        require(owner_ != address(0), "Owner cannot be zero address");
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(maxSupply_ > 0, "Max supply must be greater than zero");

        bytes32 salt = keccak256(salt_);

        tokenAddress = address(
            new L2SuperChainToken{salt: salt}(
                owner_,
                name_,
                symbol_,
                maxSupply_
            )
        );

        // Register the token
        allTokens.push(tokenAddress);
        isTokenFromFactory[tokenAddress] = true;

        // Emit event
        emit TokenCreated(
            tokenAddress,
            name_,
            symbol_,
            decimals_,
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
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }
}
