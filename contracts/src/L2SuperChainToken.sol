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
    ERC20Permit
} from "@openzeppelin-v5/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20} from "@openzeppelin-v5/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin-v5/contracts/token/ERC20/IERC20.sol";
import {
    Ownable2Step,
    Ownable
} from "@openzeppelin-v5/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin-v5/contracts/utils/Pausable.sol";

import {ISemver} from "@contracts-bedrock-interfaces/universal/ISemver.sol";
import {IERC7802, IERC165} from "@contracts-bedrock-interfaces/L2/IERC7802.sol";

contract L2SuperChainToken is
    ERC20,
    ERC20Permit,
    IOptimismMintableERC20,
    Ownable2Step,
    IERC7802,
    ISemver,
    Pausable
{
    /// @notice Error for an unauthorized CALLER.
    error Unauthorized();

    error ZeroAddress();
    error ExceedsMaxSupply();
    error NewMaxSupplyTooLow();
    error NoPendingOwnershipTransfer();
    error NotPendingOwner();
    error OptimismMintableERC20__OnlyBridge();
    error OnlyOwner();

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
        uint256 maxSupply_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
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

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == type(IOptimismMintableERC20).interfaceId ||
            interfaceId == type(IERC7802).interfaceId ||
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
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

    /// @notice Burns tokens. Called by bridge during withdrawals or by owner when bridge not set.
    function burn(
        address from_,
        uint256 amount_
    ) external whenNotPaused onlyOwnerOrBridge {
        if (from_ == address(0)) revert ZeroAddress();
        _burn(from_, amount_);
    }

    /// @notice Allows owner to burn their own tokens to neutralize bridged supply.
    /// @dev Used after bridging from L1 to burn the minted tokens and maintain supply.
    function burnFromTreasury(
        uint256 amount_
    ) external onlyOwner whenNotPaused {
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

    /// @notice Semantic version.
    /// @custom:semver 1.0.2
    function version() external view virtual returns (string memory) {
        return "1.0.2";
    }

    /// @notice Allows the SuperchainTokenBridge to mint tokens.
    /// @param _to     Address to mint tokens to.
    /// @param _amount Amount of tokens to mint.
    function crosschainMint(address _to, uint256 _amount) external {
        if (msg.sender != Predeploys.SUPERCHAIN_TOKEN_BRIDGE)
            revert Unauthorized();

        _mint(_to, _amount);

        emit CrosschainMint(_to, _amount, msg.sender);
    }

    /// @notice Allows the SuperchainTokenBridge to burn tokens.
    /// @param _from   Address to burn tokens from.
    /// @param _amount Amount of tokens to burn.
    function crosschainBurn(address _from, uint256 _amount) external {
        if (msg.sender != Predeploys.SUPERCHAIN_TOKEN_BRIDGE)
            revert Unauthorized();

        _burn(_from, _amount);

        emit CrosschainBurn(_from, _amount, msg.sender);
    }
}
