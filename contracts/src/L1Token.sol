//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {ERC20} from "@openzeppelin-v5/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin-v5/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {
    Ownable2Step,
    Ownable
} from "@openzeppelin-v5/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin-v5/contracts/utils/Pausable.sol";

contract L1Token is ERC20, ERC20Permit, Ownable2Step, Pausable {

    error ZeroAddress();
    error ExceedsMaxSupply();
    error NewMaxSupplyTooLow();
    error NoPendingOwnershipTransfer();
    error OnlyOwner();

    uint256 public maxSupply;

    address public remoteToken;
    address public bridge;

    event MaxSupplyUpdated(uint256 newMaxSupply);
    event RemoteTokenUpdated(address indexed newRemoteToken);
    event BridgeUpdated(address indexed newBridge);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        maxSupply = initialSupply_;
    }

    // ============================================
    //         MINT FUNCTIONS
    // ============================================

    function mint(
        address to_,
        uint256 amount_
    ) external onlyOwner whenNotPaused {
        if (to_ == address(0)) revert ZeroAddress();
        uint256 newSupply = totalSupply() + amount_;
        if (newSupply > maxSupply) revert ExceedsMaxSupply();
        _mint(to_, amount_);
    }

    // ============================================
    //         BURN FUNCTIONS
    // ============================================

    function burn(address from_, uint256 amount_) external whenNotPaused {
        if (from_ == address(0)) revert ZeroAddress();
        _burn(msg.sender, amount_);
    }

    // ============================================
    //         TRANSFER FUNCTIONS
    // ============================================

    function transfer(
        address to_,
        uint256 amount_
    ) public virtual override whenNotPaused returns (bool) {
        return super.transfer(to_, amount_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) public virtual override whenNotPaused returns (bool) {
        return super.transferFrom(from_, to_, amount_);
    }

    function approve(
        address spender_,
        uint256 amount_
    ) public virtual override whenNotPaused returns (bool) {
        return super.approve(spender_, amount_);
    }

    // ============================================
    //         SUPPLY LIMIT FUNCTIONS
    // ============================================

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        if (newMaxSupply < totalSupply()) revert NewMaxSupplyTooLow();
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }
}
