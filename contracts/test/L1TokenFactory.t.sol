// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L1Token} from "../src/L1Token.sol";
import {L1TokenFactory} from "../src/L1TokenFactory.sol";
import {IFactory} from "../src/interfaces/IFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

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
        tokenImplementation = new L1Token();
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
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
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
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
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
        vm.expectRevert(IFactory.InsufficientFee.selector);
        factory.createToken{value: 0.05 ether}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
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

    function test_GetTokensPaginated() public {
        vm.prank(user);
        factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked(user, uint256(1))
        );
        
        vm.prank(user);
        factory.createToken(
            user, "Token 2", "T2", DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked(user, uint256(2))
        );
        
        // Test getTokensPaginated - full range
        address[] memory paginatedTokens = factory.getTokensPaginated(0, 10);
        assertEq(paginatedTokens.length, 2);
        
        // Test getTokensPaginated - partial range
        address[] memory partialTokens = factory.getTokensPaginated(0, 1);
        assertEq(partialTokens.length, 1);
        
        // Test getTokensPaginated - offset
        address[] memory offsetTokens = factory.getTokensPaginated(1, 10);
        assertEq(offsetTokens.length, 1);
        
        // Test getTokensPaginated - offset beyond length
        address[] memory emptyTokens = factory.getTokensPaginated(10, 10);
        assertEq(emptyTokens.length, 0);
    }

    function test_OnlyOwnerCanSetFee() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setCreationFee(1 ether);
    }

    function test_InitializeWithZeroImplementation() public {
        L1TokenFactory factoryImpl = new L1TokenFactory();
        
        bytes memory initData = abi.encodeWithSelector(
            L1TokenFactory.initialize.selector,
            owner,
            address(0)
        );
        
        vm.expectRevert(IFactory.ZeroAddress.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        factory.initialize(owner, address(tokenImplementation));
    }

    function test_CreateTokenWithZeroOwner() public {
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.createToken(
            address(0), NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithZeroMaxSupply() public {
        vm.expectRevert(IFactory.MaxSupplyMustBeGreaterThanZero.selector);
        factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, 0,
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithInitialSupplyExceedsMax() public {
        vm.expectRevert(IFactory.InitialSupplyExceedsMaxSupply.selector);
        factory.createToken(
            user, NAME, SYMBOL, DECIMALS, MAX_SUPPLY + 1, MAX_SUPPLY,
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenRefundsExcess() public {
        uint256 fee = 0.1 ether;
        uint256 sent = 0.5 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, sent);
        uint256 balanceBefore = user.balance;
        
        vm.prank(user);
        factory.createToken{value: sent}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("refund-salt")
        );
        
        assertEq(user.balance, balanceBefore - fee);
    }

    function test_SetFeeRecipientZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.setFeeRecipient(address(0));
    }

    function test_SetFeeRecipientEmitsEvent() public {
        address newRecipient = address(0x999);
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IFactory.FeeRecipientUpdated(newRecipient);
        factory.setFeeRecipient(newRecipient);
    }

    function test_OnlyOwnerCanSetFeeRecipient() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setFeeRecipient(address(0x999));
    }

    function test_SetCreationFeeEmitsEvent() public {
        uint256 newFee = 0.5 ether;
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IFactory.CreationFeeUpdated(newFee);
        factory.setCreationFee(newFee);
    }

    function test_SetPromoSigner() public {
        address newSigner = address(0x888);
        vm.prank(owner);
        factory.setPromoSigner(newSigner);
        assertEq(factory.promoSigner(), newSigner);
    }

    function test_SetPromoSignerZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.setPromoSigner(address(0));
    }

    function test_OnlyOwnerCanSetPromoSigner() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setPromoSigner(address(0x888));
    }

    function test_SetPromoSignerEmitsEvent() public {
        address newSigner = address(0x888);
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IFactory.PromoSignerUpdated(newSigner);
        factory.setPromoSigner(newSigner);
    }

    function test_GetToken() public {
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("get-token-salt")
        );
        assertEq(factory.getToken(0), tokenAddress);
    }

    function test_GetTokenIndexOutOfBounds() public {
        vm.expectRevert(IFactory.IndexOutOfBounds.selector);
        factory.getToken(0);
    }

    function test_AllTokensGetter() public {
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("all-tokens-salt")
        );
        assertEq(factory.allTokens(0), tokenAddress);
    }

    function test_CreateTokenWithPromo() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("promo1");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        address tokenAddress = factory.createTokenWithPromo{value: promoFee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("promo-salt"),
            promoFee, promoNonce, expiresAt, signature
        );
        
        assertTrue(tokenAddress != address(0));
        assertTrue(factory.isPromoNonceUsed(promoNonce));
    }

    function test_CreateTokenWithPromoNonceAlreadyUsed() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("promo-reuse");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 2 ether);
        
        vm.prank(user);
        factory.createTokenWithPromo{value: promoFee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("promo-salt-1"),
            promoFee, promoNonce, expiresAt, signature
        );
        
        vm.prank(user);
        vm.expectRevert(IFactory.PromoNonceAlreadyUsed.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("promo-salt-2"),
            promoFee, promoNonce, expiresAt, signature
        );
    }

    function test_CreateTokenWithPromoExpired() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("expired-promo");
        uint256 expiresAt = block.timestamp - 1;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.PromoCodeExpired.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("expired-salt"),
            promoFee, promoNonce, expiresAt, signature
        );
    }

    function test_CreateTokenWithPromoInvalidSignature() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("invalid-sig");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 wrongSignerKey = 0x5678;
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongSignerKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.InvalidPromoSignature.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("invalid-sig-salt"),
            promoFee, promoNonce, expiresAt, signature
        );
    }

    function test_CreateTokenWithZeroFee() public {
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("zero-fee-salt")
        );
        assertTrue(tokenAddress != address(0));
    }

    function test_CreateTokenWithExactFee() public {
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(user, fee);
        vm.prank(user);
        address tokenAddress = factory.createToken{value: fee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("exact-fee-salt")
        );
        
        assertTrue(tokenAddress != address(0));
        assertEq(user.balance, 0);
    }

    function test_CreateTokenFeeTransferFailed() public {
        RejectETH rejectContract = new RejectETH();
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.prank(owner);
        factory.setFeeRecipient(address(rejectContract));
        
        vm.deal(user, fee);
        vm.prank(user);
        vm.expectRevert(IFactory.FeeTransferFailed.selector);
        factory.createToken{value: fee}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("fee-fail-salt")
        );
    }

    function test_CreateTokenRefundFailed() public {
        RejectETH rejectContract = new RejectETH();
        uint256 fee = 0.1 ether;
        uint256 sent = 0.5 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.deal(address(rejectContract), sent);
        
        vm.prank(address(rejectContract));
        vm.expectRevert(IFactory.RefundFailed.selector);
        factory.createToken{value: sent}(
            address(rejectContract), NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("refund-fail-salt")
        );
    }

    function test_CreateTokenWithPromoZeroFee() public {
        uint256 promoFee = 0;
        bytes32 promoNonce = keccak256("promo-zero-fee");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(user);
        address tokenAddress = factory.createTokenWithPromo(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("promo-zero-fee-salt"),
            promoFee, promoNonce, expiresAt, signature
        );
        
        assertTrue(tokenAddress != address(0));
    }

    function test_CreateTokenWithPromoInsufficientFee() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("promo-insuf");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(user, promoFee, promoNonce, expiresAt, block.chainid, address(factory))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 0.01 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.InsufficientFee.selector);
        factory.createTokenWithPromo{value: 0.01 ether}(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("promo-insuf-salt"),
            promoFee, promoNonce, expiresAt, signature
        );
    }

    // ============================================
    //         UUPS UPGRADE TESTS
    // ============================================

    function test_UpgradeFactory() public {
        L1TokenFactoryV2Mock newImplementation = new L1TokenFactoryV2Mock();
        
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImplementation), "");
        
        // Verify the upgrade was successful by calling the new function
        L1TokenFactoryV2Mock upgraded = L1TokenFactoryV2Mock(address(factory));
        assertEq(upgraded.newFunction(), 42);
        
        // Verify state is preserved
        assertEq(factory.owner(), owner);
        assertEq(factory.implementation(), address(tokenImplementation));
    }

    function test_OnlyOwnerCanUpgradeFactory() public {
        L1TokenFactoryV2Mock newImplementation = new L1TokenFactoryV2Mock();
        
        vm.prank(user);
        vm.expectRevert();
        factory.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradeFactoryPreservesTokenList() public {
        // Create some tokens first
        vm.prank(user);
        address token1 = factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("upgrade-salt-1")
        );
        
        vm.prank(user);
        address token2 = factory.createToken(
            user, "Token 2", "T2", DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY,
            abi.encodePacked("upgrade-salt-2")
        );

        L1TokenFactoryV2Mock newImplementation = new L1TokenFactoryV2Mock();
        
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImplementation), "");
        
        // Verify tokens are preserved
        assertEq(factory.getAllTokensCount(), 2);
        assertTrue(factory.isTokenFromFactory(token1));
        assertTrue(factory.isTokenFromFactory(token2));
        
        address[] memory tokens = factory.getTokensPaginated(0, 10);
        assertEq(tokens[0], token1);
        assertEq(tokens[1], token2);
    }

    function test_UpgradeFactoryPreservesFeeConfig() public {
        uint256 newFee = 0.5 ether;
        address newRecipient = address(0x999);
        
        vm.startPrank(owner);
        factory.setCreationFee(newFee);
        factory.setFeeRecipient(newRecipient);
        vm.stopPrank();
        
        L1TokenFactoryV2Mock newImplementation = new L1TokenFactoryV2Mock();
        
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImplementation), "");
        
        // Verify fee config is preserved
        assertEq(factory.creationFee(), newFee);
        assertEq(factory.feeRecipient(), newRecipient);
    }
}

contract RejectETH {
    receive() external payable {
        revert("No ETH accepted");
    }
    
    fallback() external payable {
        revert("No ETH accepted");
    }
}

/// @notice Mock V2 contract for upgrade tests
contract L1TokenFactoryV2Mock is L1TokenFactory {
    function newFunction() external pure returns (uint256) {
        return 42;
    }
}
