// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L1Token} from "../src/L1Token.sol";
import {L1TokenFactory} from "../src/L1TokenFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract L1TokenFactoryTest is Test {
    L1TokenFactory public factory;
    L1Token public tokenImplementation;
    
    address public owner = address(0x1);
    address public user = address(0x2);
    
    string constant NAME = "Test Token";
    string constant SYMBOL = "TT";
    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant MAX_SUPPLY = 10000 ether;
    uint8 constant DECIMALS = 18;

    function setUp() public {
        // Deploy token implementation
        tokenImplementation = new L1Token();
        
        // Deploy factory implementation
        L1TokenFactory factoryImpl = new L1TokenFactory();
        
        bytes memory initData = abi.encodeWithSelector(
            L1TokenFactory.initialize.selector,
            owner,
            address(tokenImplementation)
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(factoryImpl), initData);
        factory = L1TokenFactory(address(proxy));
    }

    function test_Initialize() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.implementation(), address(tokenImplementation));
        assertEq(factory.creationFee(), 0);
        assertEq(factory.feeRecipient(), owner);
    }

    function test_CreateToken() public {
        vm.prank(user);
        address tokenAddress = factory.createToken(
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            user,
            abi.encodePacked(user, block.timestamp)
        );
        
        assertTrue(tokenAddress != address(0));
        assertTrue(factory.isTokenFromFactory(tokenAddress));
        assertEq(factory.getAllTokensCount(), 1);
        
        L1Token token = L1Token(tokenAddress);
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.owner(), user);
    }

    function test_CreateTokenWithFee() public {
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        address tokenAddress = factory.createToken{value: fee}(
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            user,
            abi.encodePacked(user, block.timestamp)
        );
        
        assertTrue(tokenAddress != address(0));
        assertEq(owner.balance, fee);
    }

    function test_CreateTokenInsufficientFee() public {
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, 0.05 ether);
        vm.prank(user);
        vm.expectRevert("Insufficient fee");
        factory.createToken{value: 0.05 ether}(
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            user,
            abi.encodePacked(user, block.timestamp)
        );
    }

    function test_SetCreationFee() public {
        uint256 newFee = 0.5 ether;
        
        vm.prank(owner);
        factory.setCreationFee(newFee);
        
        assertEq(factory.creationFee(), newFee);
    }

    function test_SetFeeRecipient() public {
        address newRecipient = address(0x3);
        
        vm.prank(owner);
        factory.setFeeRecipient(newRecipient);
        
        assertEq(factory.feeRecipient(), newRecipient);
    }

    function test_GetAllTokens() public {
        vm.prank(user);
        factory.createToken(
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            user,
            abi.encodePacked(user, uint256(1))
        );
        
        vm.prank(user);
        factory.createToken(
            "Token 2",
            "T2",
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            user,
            abi.encodePacked(user, uint256(2))
        );
        
        address[] memory tokens = factory.getAllTokens();
        assertEq(tokens.length, 2);
    }

    function test_OnlyOwnerCanSetFee() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setCreationFee(1 ether);
    }
}
