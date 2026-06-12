# Contracts Overview

A token factory system for ERC-20 tokens across Ethereum L1 and Celo L2 (Optimism Superchain compatible). Built with Foundry. MIT licensed.

## Capabilities

* Create ERC-20 tokens with custom name, symbol, decimals, and supply limits
* Deploy on L1 or L2 with full bridge support (Optimism Standard Bridge)
* Upgrade tokens and factories (UUPS proxies)
* Promotional discounts via signed promo codes

## Feature matrix

| Feature | L1Token | L2SuperChainToken |
| ------- | ------- | ----------------- |
| ERC-20 + Permit (EIP-2612) | ✅ | ✅ |
| Upgradeable (UUPS) · Pausable · Max supply | ✅ | ✅ |
| Owner mint/burn | ✅ | ✅ |
| Bridge integration | ❌ | ✅ |
| Superchain (ERC-7802) | ❌ | ✅ |

## Core contracts

| Contract | Role |
| -------- | ---- |
| `L1Token.sol` | ERC-20 for Ethereum L1 |
| `L2SuperChainToken.sol` | Superchain-compatible ERC-20 for Celo L2 |
| `BaseTokenFactory.sol` | Shared factory logic: fees, promos, UUPS, CREATE2 |
| `L1TokenFactory.sol` / `L2SuperChainTokenFactory.sol` | Per-chain factories |
| `FactoryInitializer` / `TokenInitializer` | CREATE2 placeholders that reserve identical proxy addresses across chains |

Interfaces: `IToken`, `IFactory`, `IERC7802`, `IOptimismMintableERC20`, `ISemver`.

## Storage pattern

All contracts use **EIP-7201 namespaced storage** to prevent collisions during upgrades:

```solidity
// keccak256(abi.encode(uint256(keccak256("namespace.storage.name")) - 1)) & ~bytes32(uint256(0xff));
bytes32 private constant STORAGE_LOCATION = 0x...;
```

## Extensibility

New factories inherit `BaseTokenFactory` to get fees, promo codes, upgradeability, and deterministic deployment for free, implementing only custom creation logic.
