// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {L2SuperChainTokenFactory} from "../src/L2SuperChainTokenFactory.sol";
import {TokenInitializer} from "../src/TokenInitializer.sol";
import {IFactory} from "../src/interfaces/IFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

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
        
        // Use vm.computeCreateAddress to predict the proxy address accurately
        uint64 nonce = vm.getNonce(address(this));
        // nonce+1 will be for TokenInitializer, nonce+2 for proxy
        address predictedProxy = vm.computeCreateAddress(address(this), nonce + 1);
        
        // Deploy token initializer with predicted factory proxy address
        TokenInitializer tokenInit = new TokenInitializer(predictedProxy);
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainTokenFactory.initialize.selector,
            owner,
            address(tokenImplementation),
            address(tokenInit)
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(factoryImpl), initData);
        factory = L2SuperChainTokenFactory(address(proxy));
        
        require(address(proxy) == predictedProxy, "Proxy address mismatch");
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
        vm.expectRevert(IFactory.InsufficientFee.selector);
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

    function test_GetTokensPaginated() public {
        bytes memory salt1 = abi.encodePacked("salt5");
        bytes memory salt2 = abi.encodePacked("salt6");
        
        vm.prank(user);
        address token1 = factory.createToken(user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt1);
        
        vm.prank(user);
        address token2 = factory.createToken(user, "Token 2", "T2", DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt2);
        
        // Test getTokensPaginated - full range
        address[] memory paginatedTokens = factory.getTokensPaginated(0, 10);
        assertEq(paginatedTokens.length, 2);
        assertEq(paginatedTokens[0], token1);
        assertEq(paginatedTokens[1], token2);
        
        // Test getTokensPaginated - partial range
        address[] memory partialTokens = factory.getTokensPaginated(0, 1);
        assertEq(partialTokens.length, 1);
        assertEq(partialTokens[0], token1);
        
        // Test getTokensPaginated - offset
        address[] memory offsetTokens = factory.getTokensPaginated(1, 10);
        assertEq(offsetTokens.length, 1);
        assertEq(offsetTokens[0], token2);
        
        // Test getTokensPaginated - offset beyond length
        address[] memory emptyTokens = factory.getTokensPaginated(10, 10);
        assertEq(emptyTokens.length, 0);
    }

    function test_OnlyOwnerCanSetFee() public {
        vm.prank(user);
        vm.expectRevert();
        factory.setCreationFee(1 ether);
    }

    // ============================================
    //         INITIALIZE TESTS
    // ============================================

    function test_InitializeWithZeroImplementation() public {
        L2SuperChainTokenFactory factoryImpl = new L2SuperChainTokenFactory();
        // Pass any address for TokenInitializer factory since we expect revert anyway
        TokenInitializer tokenInit = new TokenInitializer(address(0xdead));
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainTokenFactory.initialize.selector,
            owner,
            address(0),
            address(tokenInit)
        );
        
        vm.expectRevert(IFactory.ZeroAddress.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        factory.initialize(owner, address(tokenImplementation), address(1));
    }

    // ============================================
    //         CREATE TOKEN VALIDATION TESTS
    // ============================================

    function test_CreateTokenWithZeroOwner() public {
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.createToken(
            address(0),
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithZeroMaxSupply() public {
        vm.expectRevert(IFactory.MaxSupplyMustBeGreaterThanZero.selector);
        factory.createToken(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            0,
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithInitialSupplyExceedsMax() public {
        vm.expectRevert(IFactory.InitialSupplyExceedsMaxSupply.selector);
        factory.createToken(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            MAX_SUPPLY + 1,
            MAX_SUPPLY,
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
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("refund-salt")
        );
        
        assertEq(user.balance, balanceBefore - fee);
    }

    // ============================================
    //         CREATE TOKEN WITH BRIDGE TESTS
    // ============================================

    function test_CreateTokenWithBridgeZeroBridge() public {
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0),
            address(0x200),
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithBridgeZeroRemoteToken() public {
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0x100),
            address(0),
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithBridgeNoFee() public {
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.prank(user);
        address tokenAddress = factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0x100),
            address(0x200),
            abi.encodePacked("no-fee-salt")
        );
        
        assertTrue(tokenAddress != address(0));
    }

    function test_CreateTokenWithBridgeZeroOwner() public {
        vm.expectRevert(IFactory.ZeroAddress.selector);
        factory.createTokenWithBridge(
            address(0),
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0x100),
            address(0x200),
            abi.encodePacked("salt")
        );
    }

    // ============================================
    //         SET FEE RECIPIENT TESTS
    // ============================================

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

    // ============================================
    //         SET CREATION FEE TESTS
    // ============================================

    function test_SetCreationFeeEmitsEvent() public {
        uint256 newFee = 0.5 ether;
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IFactory.CreationFeeUpdated(newFee);
        factory.setCreationFee(newFee);
    }

    // ============================================
    //         SET PROMO SIGNER TESTS
    // ============================================

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

    // ============================================
    //         GET TOKEN TESTS
    // ============================================

    function test_GetToken() public {
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
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
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("all-tokens-salt")
        );
        
        assertEq(factory.allTokens(0), tokenAddress);
    }

    // ============================================
    //         CREATE TOKEN WITH PROMO TESTS
    // ============================================

    function test_CreateTokenWithPromo() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("promo1");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        address tokenAddress = factory.createTokenWithPromo{value: promoFee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("promo-salt"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
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
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 2 ether);
        
        vm.prank(user);
        factory.createTokenWithPromo{value: promoFee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("promo-salt-1"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
        );
        
        vm.prank(user);
        vm.expectRevert(IFactory.PromoNonceAlreadyUsed.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("promo-salt-2"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
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
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.PromoCodeExpired.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("expired-salt"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
        );
    }

    function test_CreateTokenWithPromoInvalidSignature() public {
        uint256 promoFee = 0.05 ether;
        bytes32 promoNonce = keccak256("invalid-sig");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 wrongSignerKey = 0x5678;
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongSignerKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.InvalidPromoSignature.selector);
        factory.createTokenWithPromo{value: promoFee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("invalid-sig-salt"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
        );
    }

    // ============================================
    //         ADDITIONAL BRANCH COVERAGE TESTS
    // ============================================

    function test_CreateTokenWithZeroFee() public {
        // creationFee is 0 by default, covers feeAmount == 0 branch
        vm.prank(user);
        address tokenAddress = factory.createToken(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
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
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("exact-fee-salt")
        );
        
        assertTrue(tokenAddress != address(0));
        assertEq(user.balance, 0); // No refund
    }

    function test_CreateTokenFeeTransferFailed() public {
        // Deploy a contract that rejects ETH
        RejectETHForL2 rejectContract = new RejectETHForL2();
        
        uint256 fee = 0.1 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        vm.prank(owner);
        factory.setFeeRecipient(address(rejectContract));
        
        vm.deal(user, fee);
        vm.prank(user);
        vm.expectRevert(IFactory.FeeTransferFailed.selector);
        factory.createToken{value: fee}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("fee-fail-salt")
        );
    }

    function test_CreateTokenRefundFailed() public {
        // Deploy a contract that rejects ETH for refunds
        RejectETHForL2 rejectContract = new RejectETHForL2();
        
        uint256 fee = 0.1 ether;
        uint256 sent = 0.5 ether;
        
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        // Fund the reject contract and have it call createToken
        vm.deal(address(rejectContract), sent);
        
        vm.prank(address(rejectContract));
        vm.expectRevert(IFactory.RefundFailed.selector);
        factory.createToken{value: sent}(
            address(rejectContract),
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("refund-fail-salt")
        );
    }

    function test_CreateTokenWithPromoZeroFee() public {
        uint256 promoFee = 0; // Zero promo fee
        bytes32 promoNonce = keccak256("promo-zero-fee");
        uint256 expiresAt = block.timestamp + 1 days;
        
        uint256 signerPrivateKey = 0x1234;
        address signer = vm.addr(signerPrivateKey);
        
        vm.prank(owner);
        factory.setPromoSigner(signer);
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(user);
        address tokenAddress = factory.createTokenWithPromo(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("promo-zero-fee-salt"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
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
            abi.encodePacked(
                user,
                promoFee,
                promoNonce,
                expiresAt,
                block.chainid,
                address(factory)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.deal(user, 0.01 ether);
        vm.prank(user);
        vm.expectRevert(IFactory.InsufficientFee.selector);
        factory.createTokenWithPromo{value: 0.01 ether}(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            abi.encodePacked("promo-insuf-salt"),
            promoFee,
            promoNonce,
            expiresAt,
            signature
        );
    }

    function test_CreateTokenWithBridgeZeroMaxSupply() public {
        vm.expectRevert(IFactory.MaxSupplyMustBeGreaterThanZero.selector);
        factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            0, // zero max supply
            address(0x100),
            address(0x200),
            abi.encodePacked("salt")
        );
    }

    function test_CreateTokenWithBridgeInitialExceedsMax() public {
        vm.expectRevert(IFactory.InitialSupplyExceedsMaxSupply.selector);
        factory.createTokenWithBridge(
            user,
            NAME,
            SYMBOL,
            DECIMALS,
            MAX_SUPPLY + 1,
            MAX_SUPPLY,
            address(0x100),
            address(0x200),
            abi.encodePacked("salt")
        );
    }

    // ============================================
    //         UUPS UPGRADE TESTS
    // ============================================

    function test_UpgradeFactory() public {
        L2SuperChainTokenFactoryV2Mock newImplementation = new L2SuperChainTokenFactoryV2Mock();
        
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImplementation), "");
        
        // Verify the upgrade was successful by calling the new function
        L2SuperChainTokenFactoryV2Mock upgraded = L2SuperChainTokenFactoryV2Mock(address(factory));
        assertEq(upgraded.newFunction(), 42);
        
        // Verify state is preserved
        assertEq(factory.owner(), owner);
        assertEq(factory.implementation(), address(tokenImplementation));
    }

    function test_OnlyOwnerCanUpgradeFactory() public {
        L2SuperChainTokenFactoryV2Mock newImplementation = new L2SuperChainTokenFactoryV2Mock();
        
        vm.prank(user);
        vm.expectRevert();
        factory.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradeFactoryPreservesTokenList() public {
        bytes memory salt1 = abi.encodePacked("upgrade-salt-1");
        bytes memory salt2 = abi.encodePacked("upgrade-salt-2");
        
        vm.prank(user);
        address token1 = factory.createToken(
            user, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt1
        );
        
        vm.prank(user);
        address token2 = factory.createToken(
            user, "Token 2", "T2", DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, salt2
        );
        
        L2SuperChainTokenFactoryV2Mock newImplementation = new L2SuperChainTokenFactoryV2Mock();
        
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
        
        L2SuperChainTokenFactoryV2Mock newImplementation = new L2SuperChainTokenFactoryV2Mock();
        
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImplementation), "");
        
        // Verify fee config is preserved
        assertEq(factory.creationFee(), newFee);
        assertEq(factory.feeRecipient(), newRecipient);
    }

    // ============================================
    //         REENTRANCY TESTS
    // ============================================

    function test_ReentrancyOnCreateToken() public {
        // Deploy a malicious fee recipient that tries to reenter
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(factory));
        
        vm.prank(owner);
        factory.setFeeRecipient(address(attacker));
        
        uint256 fee = 0.1 ether;
        vm.prank(owner);
        factory.setCreationFee(fee);
        
        // Fund the attacker so it can pay fees
        vm.deal(address(attacker), 1 ether);
        
        // The attacker should not be able to reenter
        vm.expectRevert(); // ReentrancyGuard should block
        attacker.attack{value: fee}();
    }
}

/// @notice Helper contract that rejects ETH transfers
contract RejectETHForL2 {
    receive() external payable {
        revert("No ETH accepted");
    }
    
    fallback() external payable {
        revert("No ETH accepted");
    }
}

/// @notice Mock V2 contract for upgrade tests
contract L2SuperChainTokenFactoryV2Mock is L2SuperChainTokenFactory {
    function newFunction() external pure returns (uint256) {
        return 42;
    }
}

/// @notice Reentrancy attacker contract
contract ReentrancyAttacker {
    L2SuperChainTokenFactory public factory;
    bool public attacking;

    constructor(address _factory) {
        factory = L2SuperChainTokenFactory(_factory);
    }

    function attack() external payable {
        attacking = true;
        factory.createToken{value: msg.value}(
            address(this),
            "Attack Token",
            "ATK",
            18,
            1000 ether,
            10000 ether,
            abi.encodePacked("attack-salt")
        );
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            // Try to reenter during fee refund
            factory.createToken{value: msg.value}(
                address(this),
                "Reentry Token",
                "RNT",
                18,
                1000 ether,
                10000 ether,
                abi.encodePacked("reentry-salt")
            );
        }
    }
}
