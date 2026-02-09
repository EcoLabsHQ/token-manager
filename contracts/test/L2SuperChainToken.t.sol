// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L2SuperChainToken} from "../src/L2SuperChainToken.sol";
import {IToken} from "../src/interfaces/IToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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
            address(0)  // No remote token
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
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
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
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
}
