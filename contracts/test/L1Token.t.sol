// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L1Token} from "../src/L1Token.sol";
import {IToken} from "../src/interfaces/IToken.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

contract L1TokenTest is Test {
    L1Token public token;
    L1Token public implementation;

    address public owner = address(0x1);
    address public user = address(0x2);

    string constant NAME = "Test Token";
    string constant SYMBOL = "TT";
    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant MAX_SUPPLY = 10000 ether;
    uint8 constant DECIMALS = 18;

    function setUp() public {
        implementation = new L1Token();

        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            owner
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        token = L1Token(address(proxy));
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

    function test_Mint() public {
        uint256 mintAmount = 500 ether;

        vm.prank(owner);
        token.mint(user, mintAmount);

        assertEq(token.balanceOf(user), mintAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + mintAmount);
    }

    function test_MintExceedsMaxSupply() public {
        uint256 mintAmount = MAX_SUPPLY; // Excedería el max supply

        vm.prank(owner);
        vm.expectRevert(IToken.ExceedsMaxSupply.selector);
        token.mint(user, mintAmount);
    }

    function test_Transfer() public {
        uint256 transferAmount = 100 ether;

        vm.prank(owner);
        token.transfer(user, transferAmount);

        assertEq(token.balanceOf(user), transferAmount);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - transferAmount);
    }

    function test_Burn() public {
        uint256 burnAmount = 100 ether;

        vm.prank(owner);
        token.burn(owner, burnAmount);

        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - burnAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY - burnAmount);
    }

    function test_Pause() public {
        vm.prank(owner);
        token.pause();

        vm.prank(owner);
        vm.expectRevert();
        token.transfer(user, 100 ether);
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

    function test_SetMaxSupply() public {
        uint256 newMaxSupply = 20000 ether;

        vm.prank(owner);
        token.setMaxSupply(newMaxSupply);

        assertEq(token.maxSupply(), newMaxSupply);
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(user);
        vm.expectRevert();
        token.mint(user, 100 ether);
    }

    // ============================================
    //         INITIALIZE TESTS
    // ============================================

    function test_InitializeWithZeroOwner() public {
        L1Token newImpl = new L1Token();
        
        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            NAME,
            SYMBOL,
            INITIAL_SUPPLY,
            MAX_SUPPLY,
            DECIMALS,
            address(0)
        );
        
        vm.expectRevert(IToken.ZeroAddress.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithInitialSupplyExceedsMaxSupply() public {
        L1Token newImpl = new L1Token();
        
        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            NAME,
            SYMBOL,
            MAX_SUPPLY + 1, // initialSupply > maxSupply
            MAX_SUPPLY,
            DECIMALS,
            owner
        );
        
        vm.expectRevert(IToken.ExceedsMaxSupply.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_InitializeWithZeroInitialSupply() public {
        L1Token newImpl = new L1Token();
        
        bytes memory initData = abi.encodeWithSelector(
            L1Token.initialize.selector,
            NAME,
            SYMBOL,
            0, // zero initial supply
            MAX_SUPPLY,
            DECIMALS,
            owner
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(newImpl), initData);
        L1Token newToken = L1Token(address(proxy));
        
        assertEq(newToken.totalSupply(), 0);
        assertEq(newToken.balanceOf(owner), 0);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        token.initialize(NAME, SYMBOL, INITIAL_SUPPLY, MAX_SUPPLY, DECIMALS, owner);
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

    function test_BurnMoreThanBalance() public {
        vm.prank(owner);
        vm.expectRevert();
        token.burn(owner, INITIAL_SUPPLY + 1);
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
    //         SUPPORTS INTERFACE TESTS
    // ============================================

    function test_SupportsIERC20() public view {
        assertTrue(token.supportsInterface(type(IERC20).interfaceId));
    }

    function test_SupportsIERC165() public view {
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
    }

    function test_SupportsIERC20Permit() public view {
        assertTrue(token.supportsInterface(type(IERC20Permit).interfaceId));
    }

    function test_DoesNotSupportRandomInterface() public view {
        assertFalse(token.supportsInterface(bytes4(0xffffffff)));
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
    //         UUPS UPGRADE TESTS
    // ============================================

    function test_UpgradeToNewImplementation() public {
        L1TokenV2Mock newImplementation = new L1TokenV2Mock();
        
        vm.prank(owner);
        token.upgradeToAndCall(address(newImplementation), "");
        
        // Verify the upgrade was successful by calling the new function
        L1TokenV2Mock upgraded = L1TokenV2Mock(address(token));
        assertEq(upgraded.newFunction(), 42);
        
        // Verify state is preserved
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.owner(), owner);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_OnlyOwnerCanUpgrade() public {
        L1TokenV2Mock newImplementation = new L1TokenV2Mock();
        
        vm.prank(user);
        vm.expectRevert();
        token.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradePreservesBalances() public {
        // Transfer some tokens first
        uint256 transferAmount = 100 ether;
        vm.prank(owner);
        token.transfer(user, transferAmount);
        
        L1TokenV2Mock newImplementation = new L1TokenV2Mock();
        
        vm.prank(owner);
        token.upgradeToAndCall(address(newImplementation), "");
        
        // Verify balances are preserved
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - transferAmount);
        assertEq(token.balanceOf(user), transferAmount);
    }

    function test_UpgradePreservesMaxSupply() public {
        uint256 newMaxSupply = 50000 ether;
        vm.prank(owner);
        token.setMaxSupply(newMaxSupply);
        
        L1TokenV2Mock newImplementation = new L1TokenV2Mock();
        
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
contract L1TokenV2Mock is L1Token {
    function newFunction() external pure returns (uint256) {
        return 42;
    }
}
