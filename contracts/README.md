# ecolabs Minter - Smart Contracts

A comprehensive token factory system for creating and managing ERC20 tokens across Ethereum L1 and Celo L2 (Optimism Superchain compatible).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Contracts](#contracts)
- [Security Features](#security-features)
- [Deployment](#deployment)
- [Usage](#usage)
- [Testing](#testing)
- [Gas Optimization](#gas-optimization)
- [Upgradeability](#upgradeability)
- [Known Limitations](#known-limitations)
- [Audit Checklist](#audit-checklist)

---

## Overview

The ecolabs Minter is a token factory protocol that allows users to:

- **Create ERC20 tokens** with customizable parameters (name, symbol, decimals, supply limits)
- **Deploy on L1 (Ethereum)** or **L2 (Celo)** with full cross-chain bridge support
- **Upgrade tokens and factories** via the UUPS proxy pattern
- **Apply promotional discounts** via cryptographically signed promo codes
- **Bridge tokens** between L1 and L2 using Optimism's Standard Bridge

### Key Features

| Feature | L1Token | L2SuperChainToken |
|---------|---------|-------------------|
| ERC20 Standard | ✅ | ✅ |
| ERC20Permit (EIP-2612) | ✅ | ✅ |
| Upgradeable (UUPS) | ✅ | ✅ |
| Pausable | ✅ | ✅ |
| Max Supply Limit | ✅ | ✅ |
| Owner Minting | ✅ | ✅ |
| Owner Burning | ✅ | ✅ |
| Bridge Integration | ❌ | ✅ |
| Superchain (ERC-7802) | ❌ | ✅ |
| IOptimismMintableERC20 | ❌ | ✅ |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ETHEREUM L1                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    L1TokenFactory (Proxy)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │  L1Token    │  │  L1Token    │  │  L1Token    │   ...    │   │
│  │  │  (Proxy)    │  │  (Proxy)    │  │  (Proxy)    │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ Optimism Standard Bridge             │
│                              ▼                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             CELO L2                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              L2SuperChainTokenFactory (Proxy)                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │L2SuperChainToken│  │L2SuperChainToken│  │L2SuperChain  │ │   │
│  │  │    (Proxy)      │  │    (Proxy)      │  │Token (Proxy) │ │   │
│  │  │  [Bridged]      │  │  [Native]       │  │  [Native]    │ │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Optimism Predeploys                         │   │
│  │  • L2StandardBridge (0x4200...0010)                         │   │
│  │  • SuperchainTokenBridge (0x4200...0028)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Storage Pattern

All contracts use **EIP-7201 Namespaced Storage** to prevent storage collisions during upgrades:

```solidity
// Storage slot calculated as:
// keccak256(abi.encode(uint256(keccak256("namespace.storage.name")) - 1)) & ~bytes32(uint256(0xff));

bytes32 private constant STORAGE_LOCATION = 0x...;
```

---

## Contracts

### Core Contracts

| Contract | Description | LOC |
|----------|-------------|-----|
| [L1Token.sol](src/L1Token.sol) | ERC20 token for Ethereum L1 | 188 |
| [L2SuperChainToken.sol](src/L2SuperChainToken.sol) | Superchain-compatible token for Celo L2 | 317 |
| [BaseTokenFactory.sol](src/BaseTokenFactory.sol) | Abstract base factory with shared logic | 227 |
| [L1TokenFactory.sol](src/L1TokenFactory.sol) | Factory for L1Token deployment | 177 |
| [L2SuperChainTokenFactory.sol](src/L2SuperChainTokenFactory.sol) | Factory for L2SuperChainToken deployment | 229 |

### Interfaces

| Interface | Description |
|-----------|-------------|
| [IToken.sol](src/interfaces/IToken.sol) | Common interface for all tokens |
| [IFactory.sol](src/interfaces/IFactory.sol) | Common interface for all factories |
| [IERC7802.sol](src/interfaces/IERC7802.sol) | Crosschain ERC20 transfer interface |
| [IOptimismMintableERC20.sol](src/interfaces/IOptimismMintableERC20.sol) | Optimism bridge compatibility |
| [ISemver.sol](src/interfaces/ISemver.sol) | Semantic versioning interface |

### Contract Details

#### L1Token

```solidity
function initialize(
    string memory name_,
    string memory symbol_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    uint8 decimals_,
    address owner_
) public initializer
```

**Key Functions:**
- `mint(address to_, uint256 amount_)` - Owner-only minting with max supply check
- `burn(address from_, uint256 amount_)` - Owner-only burning from any address
- `setMaxSupply(uint256 newMaxSupply)` - Adjust max supply (must be >= current supply)
- `pause()` / `unpause()` - Emergency pause for transfers, minting, burning
- `permit(...)` - EIP-2612 gasless approvals

#### L2SuperChainToken

```solidity
function initialize(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    address bridge_,
    address remoteToken_
) public initializer
```

**Additional Functions (over L1Token):**
- `setBridge(address)` - Configure the L2StandardBridge address
- `setRemoteToken(address)` - Configure the corresponding L1 token address
- `burnFromTreasury(uint256)` - Owner burns from their own balance (for bridging)
- `crosschainMint(address, uint256)` - SuperchainTokenBridge only
- `crosschainBurn(address, uint256)` - SuperchainTokenBridge only

**Bridge Modes:**
1. **Native Mode** (bridge = 0, remoteToken = 0): Standard token, no bridging
2. **Bridged Mode** (bridge ≠ 0, remoteToken ≠ 0): Bridge can mint/burn

#### Factories

Both factories support:

```solidity
// Standard creation with fee
function createToken(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    bytes memory salt_
) external payable returns (address tokenAddress);

// Creation with promotional discount
function createTokenWithPromo(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    bytes memory salt_,
    uint256 promoFee_,
    bytes32 promoNonce_,
    uint256 expiresAt_,
    bytes memory signature_
) external payable returns (address tokenAddress);
```

**L2SuperChainTokenFactory only:**
```solidity
// No-fee creation for bridged tokens
function createTokenWithBridge(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    address bridge_,
    address remoteToken_,
    bytes memory salt_
) external returns (address tokenAddress);
```

---

## Security Features

### Access Control

| Role | L1Token | L2SuperChainToken | Factories |
|------|---------|-------------------|-----------|
| Owner | Full control | Full control | Full control |
| Bridge | N/A | mint/burn only | N/A |
| SuperchainBridge | N/A | crosschainMint/Burn | N/A |
| Anyone | transfer, approve | transfer, approve | createToken |

### Security Mechanisms

1. **Ownable2StepUpgradeable** - Two-step ownership transfer prevents accidental transfers
2. **ReentrancyGuard** - All factory functions protected against reentrancy
3. **Pausable** - Emergency pause for all transfers
4. **UUPS with onlyOwner** - Only owner can upgrade contracts
5. **EIP-7201 Storage** - Prevents storage collision on upgrade
6. **Signature Verification** - Promo codes require valid off-chain signature
7. **Nonce Tracking** - Promo codes can only be used once

### Custom Errors

```solidity
// IToken errors
error ZeroAddress();
error ExceedsMaxSupply();
error NewMaxSupplyTooLow();
error OnlyOwner();

// IFactory errors
error InsufficientFee();
error FeeTransferFailed();
error RefundFailed();
error PromoNonceAlreadyUsed();
error PromoCodeExpired();
error InvalidPromoSignature();
error IndexOutOfBounds();

// L2SuperChainToken specific
error Unauthorized();
error OptimismMintableERC20__OnlyBridge();
```

---

## Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

### Environment Variables

```bash
export PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=...
```

### Deploy L1TokenFactory (Ethereum)

```bash
forge script script/DeployL1TokenFactory.s.sol:DeployL1TokenFactory \
  --rpc-url $ETH_RPC_URL \
  --broadcast \
  --verify
```

### Deploy L2SuperChainTokenFactory (Celo)

```bash
forge script script/DeployL2SuperChainTokenFactory.s.sol:DeployL2SuperChainTokenFactory \
  --rpc-url $CELO_RPC_URL \
  --broadcast \
  --verify
```

### Deployed Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Ethereum Mainnet | L1TokenFactory | `0x8896769dA38E99Ace4C1Adc316181FEeae175074` |
| Celo Mainnet | L2SuperChainTokenFactory | `0x8896769dA38E99Ace4C1Adc316181FEeae175074` |
| Ethereum Sepolia | L1TokenFactory | `0xf87ea3325c6f5be2119d40747752bb255cdf1ee8` |
| Celo Alfajores | L2SuperChainTokenFactory | `TBD` |

---

## Usage

### Creating a Token

```solidity
// On L2 (Celo) - Native token
address newToken = factory.createToken{value: creationFee}(
    msg.sender,          // owner
    "My Token",          // name
    "MTK",               // symbol
    18,                  // decimals
    1_000_000 ether,     // initialSupply
    10_000_000 ether,    // maxSupply
    abi.encodePacked(msg.sender, block.timestamp) // salt
);

// On L2 (Celo) - Bridged token (no fee)
address bridgedToken = factory.createTokenWithBridge(
    msg.sender,          // owner
    "Bridged Token",     // name
    "BTK",               // symbol
    18,                  // decimals
    0,                   // initialSupply (bridge will mint)
    10_000_000 ether,    // maxSupply
    L2_STANDARD_BRIDGE,  // bridge address
    l1TokenAddress,      // remote token on L1
    abi.encodePacked(msg.sender, block.timestamp) // salt
);
```

### Using Promo Codes

The backend signs a message containing:
```
keccak256(abi.encodePacked(
    user,
    promoFee,
    promoNonce,
    expiresAt,
    chainId,
    factoryAddress
))
```

Then the user calls:
```solidity
factory.createTokenWithPromo{value: promoFee}(
    owner, name, symbol, decimals, initialSupply, maxSupply,
    salt, promoFee, promoNonce, expiresAt, signature
);
```

### Paginated Token Listing

```solidity
// Get tokens in batches of 100
uint256 total = factory.getAllTokensCount();
for (uint256 i = 0; i < total; i += 100) {
    address[] memory batch = factory.getTokensPaginated(i, 100);
    // Process batch...
}
```

---

## Testing

### Run All Tests

```bash
forge test
```

### Run Specific Test Categories

```bash
# Upgrade tests
forge test --match-test "test_Upgrade" -vv

# Permit tests
forge test --match-test "test_Permit" -vv

# Reentrancy tests
forge test --match-test "test_Reentrancy" -vv
```

### Coverage

```bash
forge coverage
```

### Test Summary

| Test File | Tests | Coverage Focus |
|-----------|-------|----------------|
| L1Token.t.sol | ~50 | Initialization, mint, burn, pause, permit, upgrade |
| L2SuperChainToken.t.sol | ~60 | + bridge, crosschain, supportsInterface |
| L1TokenFactory.t.sol | ~40 | Creation, fees, promo codes, pagination, upgrade |
| L2SuperChainTokenFactory.t.sol | ~50 | + createTokenWithBridge, reentrancy |

---

## Gas Optimization

| Operation | Estimated Gas |
|-----------|---------------|
| Deploy L1Token (via factory) | ~400,000 |
| Deploy L2SuperChainToken (via factory) | ~450,000 |
| Transfer | ~65,000 |
| Mint | ~70,000 |
| Burn | ~45,000 |
| Permit | ~80,000 |

**Optimizations Applied:**
- `via_ir = true` in foundry.toml for optimal compilation
- Custom errors instead of require strings
- Efficient storage layout with EIP-7201
- Minimal storage reads via caching

---

## Upgradeability

### Upgrade Process

1. Deploy new implementation contract
2. Call `upgradeToAndCall(newImplementation, "")` from owner
3. Verify state preservation

```solidity
// Example upgrade
L1TokenV2 newImpl = new L1TokenV2();
token.upgradeToAndCall(address(newImpl), "");
```

### Storage Compatibility

When upgrading, ensure:
- Only append new storage variables
- Never reorder existing storage
- Use EIP-7201 namespaced slots for new structs

---

## Known Limitations

### Design Decisions

1. **crosschainMint() bypasses maxSupply** - Intentional. The L1 token already enforces supply limits; L2 must accept whatever is bridged.

2. **approve() not pausable** - Intentional. Users should be able to revoke allowances even during emergency pause.

3. **burn() requires owner** - All burns go through owner. For user self-burns, owner must be involved.

4. **No emergency withdrawal** - Factories hold no ETH long-term; fees are forwarded immediately.

### Potential Issues

1. **Salt collision** - Using the same salt will revert (CREATE2 deterministic address already deployed)

2. **Large token lists** - Use `getTokensPaginated()` instead of iterating `allTokens(i)` for gas efficiency

3. **Bridge configuration** - Once set, bridge cannot be set to address(0) again

---

## Audit Checklist

### ✅ Completed

- [x] Access control on all privileged functions
- [x] Reentrancy protection on all external calls
- [x] Integer overflow protection (Solidity 0.8+)
- [x] EIP-7201 storage pattern for upgrades
- [x] Two-step ownership transfer
- [x] Emergency pause mechanism
- [x] Signature replay protection (nonces)
- [x] Chain ID in signature to prevent cross-chain replay
- [x] Fee handling with refunds
- [x] Comprehensive test coverage (~200 tests)

### ⚠️ Recommendations for Auditors

1. **Review crosschainMint maxSupply bypass** - Verify this is acceptable for the bridge architecture
2. **Verify EIP-7201 storage slots** - Ensure no collisions between contracts
3. **Check upgrade authorization** - Verify onlyOwner is properly enforced
4. **Promo code signature scheme** - Verify message format matches backend implementation
5. **Bridge integration** - Test with actual L2StandardBridge and SuperchainTokenBridge

---

## License

MIT

---

## Contact

- **Team**: ecolabs
- **Repository**: [GitHub](https://github.com/ecolabs/minter)
- **Documentation**: [Docs](https://docs.ecolabs.network)
