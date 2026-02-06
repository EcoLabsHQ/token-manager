// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract L2SuperChainTokenFactoryTest is Test {
    L2SuperChainTokenFactory public factory;
    L2SuperChainToken public tokenImplementation;
    
    address public owner = address(0x1);
    address public user = address(0x2);
    
    string constant NAME = "L2 Test Token";
    string constant SYMBOL = "L2TT";
    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant MAX_SUPPLY = 10000 ether;
    uint8 constant DECIMALS = 18;

    function setUp() public {
        // Deploy token implementation
        tokenImplementation = new L2SuperChainToken();
        
        // Deploy factory implementation
        L2SuperChainTokenFactory factoryImpl = new L2SuperChainTokenFactory();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainTokenFactory.initialize.selector,
            owner,
            address(tokenImplementation)
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(factoryImpl), initData);
        factory = L2SuperChainTokenFactory(address(proxy));
    }

    function test_Initialize() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.implementation(), address(tokenImplementation));
        assertEq(factory.creationFee(), 0);
        assertEq(factory.feeRecipient(), owner);
    }

    function test_CreateToken() public {
        bytes memory salt = abi.encodePacked("salt1");
        
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            salt
        );
        
        assertTrue(tokenAddress != address(0));
        assertTrue(factory.isTokenFromFactory(tokenAddress));
        assertEq(factory.getAllTokensCount(), 1);
        
        L2SuperChainToken token = L2SuperChainToken(tokenAddress);
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.owner(), user);
    }

    function test_CreateTokenWithFee() public {
        uint256 fee = 0.1 ether;
        bytes memory salt = abi.encodePacked("salt2");
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        address tokenAddress = factory.createToken{value: fee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            salt
        );
        
        assertTrue(tokenAddress != address(0));
        assertEq(owner.balance, fee);
    }

    function test_CreateTokenWithBridge() public {
        address bridge = address(0x100);
        address remoteToken = address(0x200);
        bytes memory salt = abi.encodePacked("salt3");
        
        vm.prank(user);
        address tokenAddress = factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken,
            salt
        );
        
        assertTrue(tokenAddress != address(0));
        
        L2SuperChainToken token = L2SuperChainToken(tokenAddress);
        assertEq(token.bridge(), bridge);
        assertEq(token.remoteToken(), remoteToken);
    }

    function test_CreateTokenInsufficientFee() public {
        uint256 fee = 0.1 ether;
        bytes memory salt = abi.encodePacked("salt4");
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, 0.05 ether);
        vm.prank(user);
        vm.expectRevert("Insufficient fee");
        factory.createToken{value: 0.05 ether}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            salt
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

    function test_SetPromoSigner() public {
        address newSigner = address(0x4);
        
        vm.prank(owner);
        factory.setPromoSigner(newSigner);
        
        assertEq(factory.promoSigner(), newSigner);
    }

    function test_GetAllTokens() public {
        bytes memory salt1 = abi.encodePacked("salt5");
        bytes memory salt2 = abi.encodePacked("salt6");
        
        vm.prank(user);
        factory.createToken(user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt1);
        
        vm.prank(user);
        factory.createToken(user, "Token 2", "T2", DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt2);
        
        address[] memory tokens = factory.getAllTokens();
        assertEq(tokens.length, 2);
    }

    function test_OnlyOwnerCanSetFee() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setCreationFee(1 ether);
    }
}
