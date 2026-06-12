# Architecture

Four layers: React UI → Express backend (REST + MCP) → Solidity contracts → Graph subgraph.

```
UI (React)
   │
Backend (Express.js) — REST API /api/*, MCP /mcp, IPFS + signer services
   │
Contracts — L1TokenFactory (Ethereum) ◄──► L2SuperChainTokenFactory (Celo)
            L1Token (ERC-20)          ◄──► L2SuperChainToken (ERC-20 + IERC7802)
   │
Subgraph (The Graph) — indexes tokens, transfers, events
```

| Component | Role |
| --------- | ---- |
| **UI** | Token creation wizard, wallet connection, chain switching |
| **Backend** | Calldata generation, MCP server, IPFS pinning, logos |
| **Contracts** | Upgradeable factories and tokens on L1 + L2 |
| **Subgraph** | Token/holder/transfer queries for MCP and admin |
| **Admin** | Platform analytics |

## Key design decisions

* **Deterministic addresses (CREATE2)** — identical token and factory addresses across Superchain networks, reserved via `FactoryInitializer`/`TokenInitializer` placeholders.
* **UUPS upgradeability** — factories and tokens are upgradeable proxies with EIP-7201 namespaced storage.
* **Calldata-as-a-service** — the backend never holds keys; it returns calldata, you sign.
* **OP Stack native** — L2 tokens implement `IOptimismMintableERC20` (L1↔L2 bridge) and `IERC7802` (cross-L2 via SuperchainTokenBridge `0x4200...0028`).

## Cross-L2 transfers

`crosschainBurn()` on the source chain + `crosschainMint()` on the destination — aggregate supply stays constant. Both restricted to the SuperchainTokenBridge.

Contract detail: [Contracts Overview](../contracts/overview.md).
