# Deployed Addresses

## Factories

| Network | Contract | Proxy |
| ------- | -------- | ----- |
| Ethereum Mainnet | L1TokenFactory | `0x8896769dA38E99Ace4C1Adc316181FEeae175074` |
| Celo Mainnet | L2SuperChainTokenFactory | `0x8896769dA38E99Ace4C1Adc316181FEeae175074` |
| Sepolia | L1TokenFactory | `0xf87ea3325c6f5be2119d40747752bb255cdf1ee8` |
| Celo Alfajores | L2SuperChainTokenFactory | see `contracts/broadcast/` |

{% hint style="info" %}
The factory proxy address is **identical on Ethereum and Celo mainnet** — by design, via CREATE2 + the FactoryInitializer pattern.
{% endhint %}

Implementations: Ethereum `0x563456095a3a16f86885ED0CB22fE8Af14e700B7` · Celo `0x8E3D99e0409DFD13c43D93baBdf026029DD9D920`

## Shared infrastructure (same address everywhere)

| Contract | Address |
| -------- | ------- |
| FactoryInitializer | `0xcA8da0BB3440554e4A43f1f5f71Fe289fb88BD96` |
| TokenInitializer | `0x8Ac5597F529Be4EB5Dcd73b603F856a353896F40` |

## Bridges

| Contract | Address |
| -------- | ------- |
| L1 Standard Bridge (Ethereum) | `0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe` |
| L2 Standard Bridge (Celo predeploy) | `0x4200000000000000000000000000000000000010` |
| SuperchainTokenBridge (predeploy) | `0x4200000000000000000000000000000000000028` |

Chain IDs: Ethereum `1` · Celo `42220`
