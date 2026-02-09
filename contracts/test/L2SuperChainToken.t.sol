// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {IToken} from "../src/interfaces/IToken.sol";
import {IOptimismMintableERC20} from "../src/interfaces/IOptimismMintableERC20.sol";
import {IERC7802} from "../src/interfaces/IERC7802.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

contract L2SuperChainTokenTest is Test {
    L2SuperChainToken public token;
    L2SuperChainToken public implementation;

    address public owner = address(0x1);
    address public user = address(0x2);
    address public bridge = address(0x3);
    address public remoteToken = address(0x4);

    string constant NAME = "L2 Test Token";
    string constant SYMBOL = "L2TT";
    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant MAX_SUPPLY = 10000 ether;
    uint8 constant DECIMALS = 18;

    function setUp() public {
        implementation = new L2SuperChainToken();

        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0), // No bridge
            address(0) // No remote token
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        token = L2SuperChainToken(address(proxy));
    }

    function test_Initialize() public view {
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.decimals(), DECIMALS);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.maxSupply(), MAX_SUPPLY);
        assertEq(token.owner(), owner);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_InitializeWithBridge() public {
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        L2SuperChainToken tokenWithBridge = L2SuperChainToken(address(proxy));

        assertEq(tokenWithBridge.bridge(), bridge);
        assertEq(tokenWithBridge.remoteToken(), remoteToken);
    }

    function test_MintByOwner() public {
        uint256 mintAmount = 500 ether;

        vm.prank(owner);
        token.mint(user, mintAmount);

        assertEq(token.balanceOf(user), mintAmount);
    }

    function test_MintExceedsMaxSupply() public {
        uint256 mintAmount = MAX_SUPPLY;

        vm.prank(owner);
        vm.expectRevert(IToken.ExceedsMaxSupply.selector);
        token.mint(user, mintAmount);
    }

    function test_Transfer() public {
        uint256 transferAmount = 100 ether;

        vm.prank(owner);
        token.transfer(user, transferAmount);

        assertEq(token.balanceOf(user), transferAmount);
    }

    function test_Burn() public {
        uint256 burnAmount = 100 ether;

        vm.prank(owner);
        token.burn(owner, burnAmount);

        assertEq(token.totalSupply(), INITIAL_SUPPLY - burnAmount);
    }

    function test_BurnFromTreasury() public {
        uint256 burnAmount = 100 ether;

        vm.prank(owner);
        token.burnFromTreasury(burnAmount);

        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - burnAmount);
    }

    function test_Pause() public {
        vm.prank(owner);
        token.pause();

        vm.prank(owner);
        vm.expectRevert();
        token.transfer(user, 100 ether);
    }

    function test_SetMaxSupply() public {
        uint256 newMaxSupply = 20000 ether;

        vm.prank(owner);
        token.setMaxSupply(newMaxSupply);

        assertEq(token.maxSupply(), newMaxSupply);
    }

    function test_SetBridge() public {
        vm.prank(owner);
        token.setBridge(bridge);

        assertEq(token.bridge(), bridge);
    }

    function test_SetRemoteToken() public {
        vm.prank(owner);
        token.setRemoteToken(remoteToken);

        assertEq(token.remoteToken(), remoteToken);
    }

    function test_SupportsInterface() public view {
        // IERC165 - 0x01ffc9a7
        assertTrue(token.supportsInterface(0x01ffc9a7));
    }

    // ============================================
    //         INITIALIZE TESTS
    // ============================================

    function test_InitializeWithZeroOwner() public {
        L2SuperChainToken newImpl = new L2SuperChainToken();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            address(0),
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0),
            address(0)
        );
        
        vm.expectRevert(IToken.ZeroAddress.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithInitialSupplyExceedsMaxSupply() public {
        L2SuperChainToken newImpl = new L2SuperChainToken();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            MAX_SUPPLY + 1, // initialSupply > maxSupply
            MAX_SUPPLY,
            address(0),
            address(0)
        );
        
        vm.expectRevert(IToken.ExceedsMaxSupply.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithOnlyBridgeSet() public {
        L2SuperChainToken newImpl = new L2SuperChainToken();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,      // bridge set
            address(0)   // remoteToken not set
        );
        
        vm.expectRevert(IToken.ZeroAddress.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithOnlyRemoteTokenSet() public {
        L2SuperChainToken newImpl = new L2SuperChainToken();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            address(0),  // bridge not set
            remoteToken  // remoteToken set
        );
        
        vm.expectRevert(IToken.ZeroAddress.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithZeroInitialSupply() public {
        L2SuperChainToken newImpl = new L2SuperChainToken();
        
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            0, // zero initial supply
            MAX_SUPPLY,
            address(0),
            address(0)
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(newImpl), initData);
        L2SuperChainToken newToken = L2SuperChainToken(address(proxy));
        
        assertEq(newToken.totalSupply(), 0);
        assertEq(newToken.balanceOf(owner), 0);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        token.initialize(owner, NAME, SYMBOL, DECIMALS, INITIAL_SUPPLY, MAX_SUPPLY, address(0), address(0));
    }

    // ============================================
    //         MINT ADDITIONAL TESTS
    // ============================================

    function test_MintToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IToken.ZeroAddress.selector);
        token.mint(address(0), 100 ether);
    }

    function test_MintWhenPaused() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(owner);
        vm.expectRevert();
        token.mint(user, 100 ether);
    }

    function test_MintByBridgeWhenBridgeSet() public {
        // Setup token with bridge
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        L2SuperChainToken tokenWithBridge = L2SuperChainToken(address(proxy));
        
        // Bridge can mint
        vm.prank(bridge);
        tokenWithBridge.mint(user, 100 ether);
        
        assertEq(tokenWithBridge.balanceOf(user), 100 ether);
    }

    function test_MintByOwnerWhenBridgeSet_Reverts() public {
        // Setup token with bridge
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        L2SuperChainToken tokenWithBridge = L2SuperChainToken(address(proxy));
        
        // Owner cannot mint when bridge is set
        vm.prank(owner);
        vm.expectRevert(L2SuperChainToken.OptimismMintableERC20__OnlyBridge.selector);
        tokenWithBridge.mint(user, 100 ether);
    }

    function test_MintByNonOwnerNonBridge_Reverts() public {
        vm.prank(user);
        vm.expectRevert(IToken.OnlyOwner.selector);
        token.mint(user, 100 ether);
    }

    // ============================================
    //         BURN ADDITIONAL TESTS
    // ============================================

    function test_BurnWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IToken.ZeroAddress.selector);
        token.burn(address(0), 100 ether);
    }

    function test_BurnWhenPaused() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(owner);
        vm.expectRevert();
        token.burn(owner, 100 ether);
    }

    function test_BurnByBridgeWhenBridgeSet() public {
        // Setup token with bridge
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        L2SuperChainToken tokenWithBridge = L2SuperChainToken(address(proxy));
        
        // Bridge can burn
        vm.prank(bridge);
        tokenWithBridge.burn(owner, 100 ether);
        
        assertEq(tokenWithBridge.balanceOf(owner), INITIAL_SUPPLY - 100 ether);
    }

    function test_BurnByOwnerWhenBridgeSet_Reverts() public {
        // Setup token with bridge
        bytes memory initData = abi.encodeWithSelector(
            L2SuperChainToken.initialize.selector,
            owner,
            NAME,
            SYMBOL,
            DECIMALS,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            bridge,
            remoteToken
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        L2SuperChainToken tokenWithBridge = L2SuperChainToken(address(proxy));
        
        // Owner cannot burn when bridge is set
        vm.prank(owner);
        vm.expectRevert(L2SuperChainToken.OptimismMintableERC20__OnlyBridge.selector);
        tokenWithBridge.burn(owner, 100 ether);
    }

    function test_BurnByNonOwnerNonBridge_Reverts() public {
        vm.prank(user);
        vm.expectRevert(IToken.OnlyOwner.selector);
        token.burn(owner, 100 ether);
    }

    // ============================================
    //         BURN FROM TREASURY TESTS
    // ============================================

    function test_BurnFromTreasuryWhenPaused() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(owner);
        vm.expectRevert();
        token.burnFromTreasury(100 ether);
    }

    function test_BurnFromTreasuryByNonOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        token.burnFromTreasury(100 ether);
    }

    function test_BurnFromTreasuryMoreThanBalance() public {
        vm.prank(owner);
        vm.expectRevert();
        token.burnFromTreasury(INITIAL_SUPPLY + 1);
    }

    // ============================================
    //         PAUSE ADDITIONAL TESTS
    // ============================================

    function test_OnlyOwnerCanPause() public {
        vm.prank(user);
        vm.expectRevert();
        token.pause();
    }

    function test_OnlyOwnerCanUnpause() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(user);
        vm.expectRevert();
        token.unpause();
    }

    function test_Unpause() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(owner);
        token.unpause();
        
        vm.prank(owner);
        token.transfer(user, 100 ether);
        
        assertEq(token.balanceOf(user), 100 ether);
    }

    function test_ApproveWhenPaused() public {
        vm.prank(owner);
        token.pause();
        
        vm.prank(owner);
        token.approve(user, 100 ether);
    }

    function test_TransferFromWhenPaused() public {
        // First approve
        vm.prank(owner);
        token.approve(user, 100 ether);
        
        // Then pause
        vm.prank(owner);
        token.pause();
        
        // Try transferFrom
        vm.prank(user);
        vm.expectRevert();
        token.transferFrom(owner, user, 100 ether);
    }

    // ============================================
    //         SET MAX SUPPLY ADDITIONAL TESTS
    // ============================================

    function test_SetMaxSupplyBelowTotalSupply() public {
        vm.prank(owner);
        vm.expectRevert(IToken.NewMaxSupplyTooLow.selector);
        token.setMaxSupply(INITIAL_SUPPLY - 1);
    }

    function test_OnlyOwnerCanSetMaxSupply() public {
        vm.prank(user);
        vm.expectRevert();
        token.setMaxSupply(20000 ether);
    }

    function test_SetMaxSupplyEmitsEvent() public {
        uint256 newMaxSupply = 20000 ether;
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IToken.MaxSupplyUpdated(newMaxSupply);
        token.setMaxSupply(newMaxSupply);
    }

    // ============================================
    //         SET BRIDGE / REMOTE TOKEN TESTS
    // ============================================

    function test_SetBridgeZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IToken.ZeroAddress.selector);
        token.setBridge(address(0));
    }

    function test_SetBridgeByNonOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        token.setBridge(bridge);
    }

    function test_SetBridgeEmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit L2SuperChainToken.BridgeUpdated(bridge);
        token.setBridge(bridge);
    }

    function test_SetRemoteTokenZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(IToken.ZeroAddress.selector);
        token.setRemoteToken(address(0));
    }

    function test_SetRemoteTokenByNonOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        token.setRemoteToken(remoteToken);
    }

    function test_SetRemoteTokenEmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit L2SuperChainToken.RemoteTokenUpdated(remoteToken);
        token.setRemoteToken(remoteToken);
    }

    // ============================================
    //         TRANSFER FROM / APPROVE TESTS
    // ============================================

    function test_Approve() public {
        uint256 amount = 500 ether;
        
        vm.prank(owner);
        token.approve(user, amount);
        
        assertEq(token.allowance(owner, user), amount);
    }

    function test_TransferFrom() public {
        uint256 amount = 500 ether;
        
        vm.prank(owner);
        token.approve(user, amount);
        
        vm.prank(user);
        token.transferFrom(owner, user, amount);
        
        assertEq(token.balanceOf(user), amount);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    function test_TransferFromInsufficientAllowance() public {
        vm.prank(owner);
        token.approve(user, 100 ether);
        
        vm.prank(user);
        vm.expectRevert();
        token.transferFrom(owner, user, 200 ether);
    }

    // ============================================
    //         SUPPORTS INTERFACE ADDITIONAL TESTS
    // ============================================

    function test_SupportsIERC20() public view {
        // IERC20 - 0x36372b07
        assertTrue(token.supportsInterface(0x36372b07));
    }

    function test_SupportsIERC20Permit() public view {
        // IERC20Permit interface
        assertTrue(token.supportsInterface(type(IERC20Permit).interfaceId));
    }

    function test_SupportsIOptimismMintableERC20() public view {
        assertTrue(token.supportsInterface(type(IOptimismMintableERC20).interfaceId));
    }

    function test_SupportsIERC7802() public view {
        assertTrue(token.supportsInterface(type(IERC7802).interfaceId));
    }

    function test_DoesNotSupportRandomInterface() public view {
        assertFalse(token.supportsInterface(bytes4(0xffffffff)));
    }

    // ============================================
    //         CROSSCHAIN FUNCTIONS TESTS
    // ============================================

    function test_CrosschainMintBySuperchainBridge() public {
        address superchainBridge = 0x4200000000000000000000000000000000000028;
        
        vm.prank(superchainBridge);
        token.crosschainMint(user, 100 ether);
        
        assertEq(token.balanceOf(user), 100 ether);
    }

    function test_CrosschainMintByUnauthorized_Reverts() public {
        vm.prank(user);
        vm.expectRevert(L2SuperChainToken.Unauthorized.selector);
        token.crosschainMint(user, 100 ether);
    }

    function test_CrosschainBurnBySuperchainBridge() public {
        address superchainBridge = 0x4200000000000000000000000000000000000028;
        
        // First give user some tokens
        vm.prank(owner);
        token.transfer(user, 100 ether);
        
        vm.prank(superchainBridge);
        token.crosschainBurn(user, 50 ether);
        
        assertEq(token.balanceOf(user), 50 ether);
    }

    function test_CrosschainBurnByUnauthorized_Reverts() public {
        vm.prank(user);
        vm.expectRevert(L2SuperChainToken.Unauthorized.selector);
        token.crosschainBurn(owner, 100 ether);
    }

    // ============================================
    //         OWNERSHIP (Ownable2Step) TESTS
    // ============================================

    function test_TransferOwnership() public {
        vm.prank(owner);
        token.transferOwnership(user);
        
        assertEq(token.pendingOwner(), user);
        assertEq(token.owner(), owner); // Still owner until accepted
    }

    function test_AcceptOwnership() public {
        vm.prank(owner);
        token.transferOwnership(user);
        
        vm.prank(user);
        token.acceptOwnership();
        
        assertEq(token.owner(), user);
        assertEq(token.pendingOwner(), address(0));
    }

    function test_OnlyPendingOwnerCanAccept() public {
        vm.prank(owner);
        token.transferOwnership(user);
        
        address randomUser = address(0x999);
        vm.prank(randomUser);
        vm.expectRevert();
        token.acceptOwnership();
    }

    function test_OnlyOwnerCanTransferOwnership() public {
        vm.prank(user);
        vm.expectRevert();
        token.transferOwnership(user);
    }

    // ============================================
    //         VERSION TEST
    // ============================================

    function test_Version() public view {
        assertEq(token.version(), "1.0.2");
    }

    // ============================================
    //         UUPS UPGRADE TESTS
    // ============================================

    function test_UpgradeToNewImplementation() public {
        L2SuperChainTokenV2Mock newImplementation = new L2SuperChainTokenV2Mock();
        
        vm.prank(owner);
        token.upgradeToAndCall(address(newImplementation), "");
        
        // Verify the upgrade was successful by calling the new function
        L2SuperChainTokenV2Mock upgraded = L2SuperChainTokenV2Mock(address(token));
        assertEq(upgraded.newFunction(), 42);
        
        // Verify state is preserved
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.owner(), owner);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_OnlyOwnerCanUpgrade() public {
        L2SuperChainTokenV2Mock newImplementation = new L2SuperChainTokenV2Mock();
        
        vm.prank(user);
        vm.expectRevert();
        token.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradePreservesBalances() public {
        // Transfer some tokens first
        uint256 transferAmount = 100 ether;
        vm.prank(owner);
        token.transfer(user, transferAmount);
        
        L2SuperChainTokenV2Mock newImplementation = new L2SuperChainTokenV2Mock();
        
        vm.prank(owner);
        token.upgradeToAndCall(address(newImplementation), "");
        
        // Verify balances are preserved
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - transferAmount);
        assertEq(token.balanceOf(user), transferAmount);
    }

    function test_UpgradePreservesBridgeConfig() public {
        // Create a token with bridge configuration
        L2SuperChainToken bridgedToken;
        {
            bytes memory initData = abi.encodeWithSelector(
                L2SuperChainToken.initialize.selector,
                owner,
                NAME,
                SYMBOL,
                DECIMALS,
                INITIAL_SUPPLY,
                MAX_SUPPLY,
                bridge,
                remoteToken
            );

            ERC1967Proxy proxy = new ERC1967Proxy(
                address(implementation),
                initData
            );
            bridgedToken = L2SuperChainToken(address(proxy));
        }
        
        L2SuperChainTokenV2Mock newImplementation = new L2SuperChainTokenV2Mock();
        
        vm.prank(owner);
        bridgedToken.upgradeToAndCall(address(newImplementation), "");
        
        // Verify bridge config is preserved
        assertEq(bridgedToken.bridge(), bridge);
        assertEq(bridgedToken.remoteToken(), remoteToken);
    }

    function test_UpgradePreservesMaxSupply() public {
        uint256 newMaxSupply = 50000 ether;
        vm.prank(owner);
        token.setMaxSupply(newMaxSupply);
        
        L2SuperChainTokenV2Mock newImplementation = new L2SuperChainTokenV2Mock();
        
        vm.prank(owner);
        token.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(token.maxSupply(), newMaxSupply);
    }

    // ============================================
    //         ERC20 PERMIT TESTS
    // ============================================

    function test_Permit() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Transfer some tokens to signer
        vm.prank(owner);
        token.transfer(signer, 100 ether);
        
        uint256 nonce = token.nonces(signer);
        uint256 deadline = block.timestamp + 1 days;
        uint256 amount = 50 ether;
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        user,
                        amount,
                        nonce,
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        token.permit(signer, user, amount, deadline, v, r, s);
        
        assertEq(token.allowance(signer, user), amount);
        assertEq(token.nonces(signer), nonce + 1);
    }

    function test_PermitExpired() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        uint256 deadline = block.timestamp - 1; // Already expired
        uint256 amount = 50 ether;
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        user,
                        amount,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        vm.expectRevert();
        token.permit(signer, user, amount, deadline, v, r, s);
    }

    function test_PermitInvalidSignature() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        uint256 wrongPrivateKey = 0xBAD;
        
        uint256 deadline = block.timestamp + 1 days;
        uint256 amount = 50 ether;
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        user,
                        amount,
                        token.nonces(signer),
                        deadline
                    )
                )
            )
        );
        
        // Sign with wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);
        
        vm.expectRevert();
        token.permit(signer, user, amount, deadline, v, r, s);
    }

    function test_PermitReplayProtection() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        vm.prank(owner);
        token.transfer(signer, 100 ether);
        
        uint256 nonce = token.nonces(signer);
        uint256 deadline = block.timestamp + 1 days;
        uint256 amount = 50 ether;
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        user,
                        amount,
                        nonce,
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        // First permit should succeed
        token.permit(signer, user, amount, deadline, v, r, s);
        
        // Replay should fail
        vm.expectRevert();
        token.permit(signer, user, amount, deadline, v, r, s);
    }
}

/// @notice Mock V2 contract for upgrade tests
contract L2SuperChainTokenV2Mock is L2SuperChainToken {
    function newFunction() external pure returns (uint256) {
        return 42;
    }
}
