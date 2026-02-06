// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Test} from "forge-std/Test.sol";
import {L1Token} from "../src/L1Token.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
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
        vm.expectRevert(L1Token.ExceedsMaxSupply.selector);
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
}
