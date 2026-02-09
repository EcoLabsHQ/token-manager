//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {
    ERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
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

import {IToken} from "./interfaces/IToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract L1Token is
    IToken,
    Initializable,
    UUPSUpgradeable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    struct L1TokenStorage {
        uint256 maxSupply;
        uint8 decimals;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.l1_token_v1")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant L1_TOKEN_STORAGE_LOCATION =
        0xd355fc3da979998436fdf5382f271272d09361ce528d1ba17a9d10200b7b7d00;

    function _getL1TokenStorage()
        private
        pure
        returns (L1TokenStorage storage $)
    {
        assembly {
            $.slot := L1_TOKEN_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        uint8 decimals_,
        address owner_
    ) public initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        if (initialSupply_ > maxSupply_) revert ExceedsMaxSupply();

        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __Ownable2Step_init();
        __Pausable_init();

        L1TokenStorage storage $ = _getL1TokenStorage();
        $.maxSupply = maxSupply_;
        $.decimals = decimals_;

        _transferOwnership(owner_);

        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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
    //         STORAGE GETTERS
    // ============================================

    function maxSupply() public view returns (uint256) {
        return _getL1TokenStorage().maxSupply;
    }

    function decimals() public view virtual override(ERC20Upgradeable, IToken) returns (uint8) {
        return _getL1TokenStorage().decimals;
    }

    // ============================================
    //         MINT FUNCTIONS
    // ============================================

    function mint(
        address to_,
        uint256 amount_
    ) external onlyOwner whenNotPaused {
        L1TokenStorage storage $ = _getL1TokenStorage();
        if (to_ == address(0)) revert ZeroAddress();
        uint256 newSupply = totalSupply() + amount_;
        if (newSupply > $.maxSupply) revert ExceedsMaxSupply();
        _mint(to_, amount_);
    }

    // ============================================
    //         BURN FUNCTIONS
    // ============================================

    function burn(address from_, uint256 amount_) external onlyOwner whenNotPaused {
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
    ) public virtual override returns (bool) {
        return super.approve(spender_, amount_);
    }

    // ============================================
    //         SUPPLY LIMIT FUNCTIONS
    // ============================================

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        L1TokenStorage storage $ = _getL1TokenStorage();
        if (newMaxSupply < totalSupply()) revert NewMaxSupplyTooLow();
        $.maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC20Permit).interfaceId;
    }
}
