//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Predeploys} from "./optimism/Predeploys.sol";
import {IOptimismMintableERC20} from "./interfaces/IOptimismMintableERC20.sol";
import {
    ERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    Ownable2StepUpgradeable,
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ISemver} from "./interfaces/ISemver.sol";
import {IERC7802, IERC165} from "./interfaces/IERC7802.sol";

import {
    IERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IToken} from "./interfaces/IToken.sol";

contract L2SuperChainToken is
    IToken,
    Initializable,
    UUPSUpgradeable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    IOptimismMintableERC20,
    Ownable2StepUpgradeable,
    IERC7802,
    ISemver,
    PausableUpgradeable
{
    /// @notice Error for an unauthorized CALLER.
    error Unauthorized();
    error OptimismMintableERC20__OnlyBridge();

    event RemoteTokenUpdated(address indexed newRemoteToken);
    event BridgeUpdated(address indexed newBridge);

    struct L2SuperChainTokenStorage {
        uint256 maxSupply;
        address remoteToken;
        address bridge;
        uint8 decimals;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l2_superchain_token_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L2_SUPERCHAIN_TOKEN_STORAGE_LOCATION =
        0x6ca55573396bd83f915ea4b495c2a0d5c214962f132c104dbed6448ef977ac00;

    function _getL2SuperChainTokenStorage()
        private
        pure
        returns (L2SuperChainTokenStorage storage $)
    {
        assembly {
            $.slot := L2_SUPERCHAIN_TOKEN_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the token
     * @param owner_ Address of the token owner
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param decimals_ Number of decimals
     * @param initialSupply_ Initial supply to mint to owner
     * @param maxSupply_ Maximum supply
     * @param bridge_ Address of the bridge contract (optional, use address(0) if not applicable)
     * @param remoteToken_ Address of the remote token on L1 (optional, use address(0) if not applicable)
     */
    function initialize(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        address bridge_,
        address remoteToken_
    ) public initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        if (initialSupply_ > maxSupply_) revert ExceedsMaxSupply();
        // bridge_ and remoteToken_ can be address(0) for Celo-native tokens
        // They must both be set or both be zero
        if ((bridge_ == address(0)) != (remoteToken_ == address(0))) {
            revert ZeroAddress(); // Both must be set or both must be zero
        }

        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __Ownable2Step_init();
        __Pausable_init();

        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        $.maxSupply = maxSupply_;
        $.remoteToken = remoteToken_;
        $.bridge = bridge_;
        $.decimals = decimals_;

        _transferOwnership(owner_);

        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
        }

        if (bridge_ != address(0)) {
            emit BridgeUpdated(bridge_);
        }
        if (remoteToken_ != address(0)) {
            emit RemoteTokenUpdated(remoteToken_);
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ============================================
    //         STORAGE GETTERS
    // ============================================

    function maxSupply() public view returns (uint256) {
        return _getL2SuperChainTokenStorage().maxSupply;
    }

    function remoteToken() public view returns (address) {
        return _getL2SuperChainTokenStorage().remoteToken;
    }

    function bridge() public view returns (address) {
        return _getL2SuperChainTokenStorage().bridge;
    }

    function decimals() public view virtual override(ERC20Upgradeable, IToken) returns (uint8) {
        return _getL2SuperChainTokenStorage().decimals;
    }

    // ============================================
    //        MODIFIERS
    // ============================================

    modifier onlyOwnerOrBridge() {
        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        if ($.bridge != address(0)) {
            if (msg.sender != $.bridge)
                revert OptimismMintableERC20__OnlyBridge();
        } else {
            if (msg.sender != owner()) revert OnlyOwner();
        }
        _;
    }

    // ============================================
    //         PAUSE FUNCTIONS
    // ============================================

    /// @notice Pauses all token transfers
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses all token transfers
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    //         CONFIGURATION FUNCTIONS
    // ============================================

    function setRemoteToken(address _remoteToken) external onlyOwner {
        if (_remoteToken == address(0)) revert ZeroAddress();
        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        $.remoteToken = _remoteToken;
        emit RemoteTokenUpdated(_remoteToken);
    }

    function setBridge(address _bridge) external onlyOwner {
        if (_bridge == address(0)) revert ZeroAddress();
        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        $.bridge = _bridge;
        emit BridgeUpdated(_bridge);
    }

    function supportsInterface(bytes4 interfaceId) public pure override(IERC165, IToken) returns (bool) {
        return
            interfaceId == type(IOptimismMintableERC20).interfaceId ||
            interfaceId == type(IERC7802).interfaceId ||
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC20Permit).interfaceId;
    }

    // ============================================
    //         MINT FUNCTIONS
    // ============================================

    function mint(
        address to_,
        uint256 amount_
    ) external override(IOptimismMintableERC20, IToken) onlyOwnerOrBridge whenNotPaused {
        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        if (to_ == address(0)) revert ZeroAddress();
        uint256 newSupply = totalSupply() + amount_;
        if (newSupply > $.maxSupply) revert ExceedsMaxSupply();
        _mint(to_, amount_);
    }

    // ============================================
    //         BURN FUNCTIONS
    // ============================================

    /// @notice Burns tokens. Called by bridge during withdrawals or by owner when bridge not set.
    function burn(
        address from_,
        uint256 amount_
    ) external override(IOptimismMintableERC20, IToken) whenNotPaused onlyOwnerOrBridge {
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
    ) public virtual override returns (bool) {
        return super.approve(spender_, amount_);
    }

    // ============================================
    //         SUPPLY LIMIT FUNCTIONS
    // ============================================

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        L2SuperChainTokenStorage storage $ = _getL2SuperChainTokenStorage();
        if (newMaxSupply < totalSupply()) revert NewMaxSupplyTooLow();
        $.maxSupply = newMaxSupply;
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
