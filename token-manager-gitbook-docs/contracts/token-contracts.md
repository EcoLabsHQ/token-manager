# Token Contracts

## Shared features

Standard ERC-20 with EIP-2612 permit · UUPS upgradeable (EIP-1967) · EIP-7201 namespaced storage · max supply enforced on all mints · owner-controlled mint/burn · pausable transfers · `tokenURI()` returns base64-encoded ERC-7572 JSON metadata.

## L1Token (Ethereum)

Standard L1 ERC-20. Initial supply minted to a recipient at deployment. No bridge logic — when paired with an L2 token, the Optimism Standard Bridge locks/unlocks L1 supply.

Key functions: `mint()`, `burn()` (owner only), `setMaxSupply()` (≥ current supply), `pause()`/`unpause()`, `permit()`.

## L2SuperChainToken (Celo)

All L1Token features, plus:

* `IOptimismMintableERC20` — L2StandardBridge can `mint()`/`burn()` when bridging from L1
* `IERC7802` — SuperchainTokenBridge (`0x4200...0028`) can `crosschainMint()`/`crosschainBurn()` for cross-L2 transfers
* `setBridge()` / `setRemoteToken()` — link to an L1 counterpart (owner only, used in [migration](../guides/l2-to-l1-migration.md))
* `burnFromTreasury()` — owner burns own balance for bridging

### Bridge modes

| Mode | Config | Behavior |
| ---- | ------ | -------- |
| **Native** | `bridge = 0`, `remoteToken = 0` | Standard token, owner controls supply |
| **Bridged** | both set | Bridge mints/burns L2 supply to mirror L1 locked supply |

## Cross-L2 transfers

`crosschainBurn()` on the source chain + `crosschainMint()` on the destination (e.g. Celo ↔ Base ↔ OP Mainnet). Aggregate supply across chains stays constant. Both restricted to the SuperchainTokenBridge.
