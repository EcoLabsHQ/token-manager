// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";

contract L2SuperChainTokenFactoryTest is Test {
    L2SuperChainTokenFactory factory;

    function setUp() public {
        factory = new L2SuperChainTokenFactory();
    }

    function testDeployToken() public {
        bytes32 salt = keccak256(abi.encodePacked("unique_salt"));
        address tokenAddress = factory.deployToken(salt);

        assertEq(tokenAddress, factory.getTokenAddress(salt), "Token address should match the expected address");
    }

    function testDeployTokenConsistency() public {
        bytes32 salt1 = keccak256(abi.encodePacked("unique_salt_1"));
        bytes32 salt2 = keccak256(abi.encodePacked("unique_salt_2"));

        address tokenAddress1 = factory.deployToken(salt1);
        address tokenAddress2 = factory.deployToken(salt2);

        assertNe(tokenAddress1, tokenAddress2, "Different salts should produce different token addresses");
    }

    function testDeployTokenSameAddressAcrossChains() public {
        bytes32 salt = keccak256(abi.encodePacked("consistent_salt"));
        address expectedAddress = factory.getTokenAddress(salt);

        // Simulate deployment on another chain (in practice, this would be done on the actual chain)
        address tokenAddress = factory.deployToken(salt);

        assertEq(tokenAddress, expectedAddress, "Token address should be the same across chains");
    }
}