//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Predeploys} from "@contracts-bedrock/libraries/Predeploys.sol";
import {
    SuperchainERC20,
    IERC165
} from "@contracts-bedrock/L2/SuperchainERC20.sol";
import {
    IOptimismMintableERC20
} from "@contracts-bedrock-interfaces/universal/IOptimismMintableERC20.sol";
import {
    Ownable2Step,
    Ownable
} from "@openzeppelin-v5/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin-v5/contracts/utils/Pausable.sol";

contract L2SuperChainToken is
    SuperchainERC20,
    IOptimismMintableERC20,
    Ownable2Step,
    Pausable
{
    error ZeroAddress();
    error ExceedsMaxSupply();
    error NewMaxSupplyTooLow();
    error NoPendingOwnershipTransfer();
    error NotPendingOwner();
    error OptimismMintableERC20__OnlyBridge();
    error OnlyOwner();

    uint8 private immutable _decimals;

    string private _name;
    string private _symbol;
    uint256 public maxSupply;

    address public remoteToken;
    address public bridge;

    event RemoteTokenUpdated(address indexed newRemoteToken);
    event BridgeUpdated(address indexed newBridge);

    event MaxSupplyUpdated(uint256 newMaxSupply);

    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxSupply_
    ) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        maxSupply = maxSupply_;
        remoteToken = address(0);
        bridge = address(0);
    }

    /// @notice A modifier that only allows the bridge to call
    modifier onlyOwnerOrBridge() {
        if (bridge != address(0)) {
            if (msg.sender != bridge)
                revert OptimismMintableERC20__OnlyBridge();
        } else {
            if (msg.sender != owner()) revert OnlyOwner();
        }
        _;
    }

    // ============================================
    //         CONFIGURATION FUNCTIONS
    // ============================================

    function setRemoteToken(address _remoteToken) external onlyOwner {
        if (_remoteToken == address(0)) revert ZeroAddress();
        remoteToken = _remoteToken;
        emit RemoteTokenUpdated(_remoteToken);
    }

    function setBridge(address _bridge) external onlyOwner {
        if (_bridge == address(0)) revert ZeroAddress();
        bridge = _bridge;
        emit BridgeUpdated(_bridge);
    }

    // ============================================
    //         METADATA FUNCTIONS
    // ============================================

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public pure override(IERC165, SuperchainERC20) returns (bool) {
        return interfaceId == type(IOptimismMintableERC20).interfaceId;
    }

    // ============================================
    //         MINT FUNCTIONS
    // ============================================

    function mint(
        address to_,
        uint256 amount_
    ) external onlyOwnerOrBridge whenNotPaused {
        if (to_ == address(0)) revert ZeroAddress();
        uint256 newSupply = totalSupply() + amount_;
        if (newSupply > maxSupply) revert ExceedsMaxSupply();
        _mint(to_, amount_);
    }

    // ============================================
    //         BURN FUNCTIONS
    // ============================================

    function burn(
        address from_,
        uint256 amount_
    ) external whenNotPaused onlyOwnerOrBridge {
        if (from_ == address(0)) revert ZeroAddress();
        _burn(from_, amount_);
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
