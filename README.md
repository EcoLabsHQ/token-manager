Token Manager
============

A comprehensive platform for deploying and managing ERC-20 tokens on Celo and Ethereum with cross-chain bridge support.

## Quick Links

| Resource | Description |
|----------|-------------|
| [Token Creation Flows](docs/TOKEN_CREATION_FLOWS.md) | Detailed documentation of all token creation flows |
| [MCP Server](backend/src/mcp/README.md) | Model Context Protocol server for AI agents |
| [Agent REST API](backend/docs/AGENT_API.md) | REST API for programmatic token creation |
| [Smart Contracts](contracts/README.md) | Solidity contracts and deployment info |
| [Subgraph](subgraph/README.md) | GraphQL API for querying tokens |

## Features

- 🚀 **Create tokens on Celo L2** - Fast, low-cost token deployment
- 🌉 **Cross-chain tokens** - Deploy on Ethereum L1 with Celo L2 bridge support
- 🤖 **AI Agent Ready** - MCP server + REST API for automated token management
- 📊 **Subgraph indexing** - Query all tokens, holders, and transfers
- 🖼️ **IPFS metadata** - ERC-7572 compliant token metadata
- 🎟️ **Promo codes** - Discounted or free token creation

## Token Types

| Type | Description | Chains |
|------|-------------|--------|
| **Celo Native** | Tokens only on Celo L2 | Celo |
| **Ethereum Enabled** | Tokens on L1 + L2 with bridge | Ethereum + Celo |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           UI (React)                            │
│                    ui/src/hooks/useCreateToken.ts               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
try {
  await switchChainAsync({ chainId: expectedChainId });
  await new Promise(resolve => setTimeout(resolve, 500));
  setIsSwitchingChain(false);
} catch (switchErr) {
  setIsSwitchingChain(false);
  const msg = switchErr instanceof Error ? switchErr.message : 'Chain switch failed';
  setError(msg);
  setIsLoading(false);
  return { success: false, error: msg }; // ← se detiene aquí
}│                      Backend (Express.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │ MCP Server  │  │      Services           │  │
│  │  /api/*     │  │   /mcp      │  │  IPFS, Signer, Storage  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Contracts (Solidity)                   │
│  ┌─────────────────────┐        ┌─────────────────────────────┐ │
│  │  L1TokenFactory     │        │  L2SuperChainTokenFactory   │ │
│  │  (Ethereum)         │◄──────►│  (Celo)                     │ │
│  └─────────────────────┘        └─────────────────────────────┘ │
│              │                              │                    │
│              ▼                              ▼                    │
│  ┌─────────────────────┐        ┌─────────────────────────────┐ │
│  │     L1Token         │        │    L2SuperChainToken        │ │
│  │  (ERC-20 + Bridge)  │◄─────►│    (ERC-20 + IERC7802)      │ │
│  └─────────────────────┘        └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Subgraph (The Graph)                       │
│               Indexes all tokens, transfers, events             │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Foundry (for contracts)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd minter

# Install dependencies
cd ui && npm install
cd ../backend && npm install
cd ../contracts && forge install
cd ../subgraph && npm install
```

### Configuration

Create `.env` files in each directory. See respective README files for required variables.

### Running Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: UI
cd ui && npm run dev

# Terminal 3: Local blockchain (optional)
cd contracts && anvil
```

## For AI Agents

### MCP (Model Context Protocol)

Connect your AI agent to the MCP server:

```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Available tools:
- `get_supported_chains` - List supported blockchains
- `get_creation_fee` - Query current token creation fee
- `pin_token_metadata` - Upload metadata to IPFS
- `build_create_token_transaction` - Generate transaction calldata
- `list_tokens` - Query created tokens
- `get_token_details` - Get token info, holders, transfers
- `validate_promo_code` - Apply promotional discounts
- `get_wallet_balance` - Check wallet funds
- `get_transaction_status` - Get tx receipt and token address

### REST API

For non-MCP agents, use the REST endpoints:

```bash
# Get deployment calldata
POST /api/tokens/full-deployment/calldata
{
  "tokenType": "celo-native",
  "owner": "0x...",
  "name": "My Token",
  "symbol": "MTK",
  "initialSupply": "1000000",
  ...
}
```

See [Agent API Documentation](backend/docs/AGENT_API.md) for full details.

---

Technical Details
-----------------

Overview
--------

The project provides a flexible architecture and simple interface for deploying and managing ERC20 tokens with different functionality on Celo L2 and Ethereum Mainnet:

### Key Components

*   **IFactory**: Base interface implemented by all token factories (`contracts/src/interfaces/IFactory.sol`)

*   **Factories**:

    *   **L2SuperChainTokenFactory**: Deploys `L2SuperChainToken` instances on Celo L2. Supports both native (no bridge) and bridged tokens.

    *   **L1TokenFactory**: Deploys `L1Token` instances on Ethereum L1. Tokens can optionally be paired with an `L2SuperChainToken` on Celo for cross-chain bridging.

*   **Shared Infrastructure**:

    *   **BaseTokenFactory**: Abstract base contract with common factory logic — fee handling, promo codes (ECDSA signatures), UUPS upgradeability, and deterministic deployment via CREATE2.

    *   **FactoryInitializer**: Placeholder implementation deployed via CREATE2 to reserve the factory proxy address on all chains before initialization.

    *   **TokenInitializer**: Placeholder implementation deployed via CREATE2 to ensure token proxy addresses are identical across all chains before upgrading to the real implementation.

*   **Token Implementations**:

    *   **L1Token**: ERC-20 token for Ethereum Mainnet. Supports owner minting/burning, max supply, pausability, EIP-2612 permit, and UUPS upgradeability.

    *   **L2SuperChainToken**: ERC-20 token for Celo L2. In addition to `L1Token` features, implements `IOptimismMintableERC20` (for the Optimism Standard Bridge) and `IERC7802` (for Superchain cross-L2 transfers).


Token Features
--------------

### Common Features (L1Token & L2SuperChainToken)

*   Standard ERC-20 with EIP-2612 permit support
*   Upgradeable via UUPS proxy pattern (EIP-1967)
*   Namespaced storage (EIP-7201) to avoid collisions during upgrades
*   Max supply enforcement on all mints
*   Owner-controlled mint and burn
*   Pausable transfers
*   `tokenURI()` returning base64-encoded ERC-7572 JSON metadata (name, symbol, description, website, image)


### L1Token (Ethereum Mainnet)

*   Standard ERC-20 for Ethereum L1 usage
*   Initial supply minted to a specified recipient at deployment
*   No bridge integration — L1 tokens are locked/unlocked by the Optimism Standard Bridge when paired with an `L2SuperChainToken`


### L2SuperChainToken (Celo L2)

*   Implements `IOptimismMintableERC20`: the Optimism L2StandardBridge can call `mint()` and `burn()` when bridging from L1
*   Implements `IERC7802`: the SuperchainTokenBridge (`0x4200000000000000000000000000000000000028`) can call `crosschainMint()` and `crosschainBurn()` for cross-L2 transfers
*   **Native mode** (`bridge = address(0)`): no bridge integration; owner controls supply entirely
*   **Bridged mode**: linked to an `L1Token` via `remoteToken`; bridge mints/burns on L2 to reflect L1 locked supply


Deployment Rules
----------------

### L1Token (Ethereum Mainnet)

*   Deployed via `L1TokenFactory.createToken()`
*   The caller (`msg.sender`) becomes the token owner
*   Initial supply minted to the specified recipient at deployment
*   Token address is deterministically derived via CREATE2 from owner, name, symbol, decimals, and salt
*   **Required validations**:
    *   Recipient cannot be zero address
    *   Initial supply cannot exceed max supply


### L2SuperChainToken (Celo L2)

*   Deployed via `L2SuperChainTokenFactory.createToken()`
*   The caller (`msg.sender`) becomes the token owner
*   **Native mode**: set `bridge = address(0)` — owner manages supply directly
*   **Bridged mode**: set `bridge = L2StandardBridge` and `remoteToken = L1Token address`
*   Token address is deterministically derived via CREATE2, enabling identical addresses across multiple Superchain networks
*   **Required validations**:
    *   If bridged: `bridge` and `remoteToken` must be non-zero addresses
    *   Initial supply cannot exceed max supply


Cross-Chain Transfers (L2SuperChainToken via Superchain)
---------------------------------------------------------

*   The SuperchainTokenBridge (`0x4200000000000000000000000000000000000028`) facilitates cross-L2 transfers (e.g. Celo ↔ Base ↔ OP Mainnet)
*   **Mechanism**:
    *   `crosschainBurn()` is called on the source chain, decreasing local `totalSupply`
    *   `crosschainMint()` is called on the destination chain, increasing local `totalSupply`
    *   Aggregate total supply across all chains remains constant
*   Both functions are restricted to the SuperchainTokenBridge


Factory Interface
-----------------

Both `L1TokenFactory` and `L2SuperChainTokenFactory` implement `IFactory` with a common `createToken` function:

```solidity
function createToken(
    string calldata name,
    string calldata symbol,
    uint8 decimals,
    uint256 initialSupply,
    uint256 maxSupply,
    address recipient,
    bytes calldata data,
    bytes32 salt
) external payable returns (address tokenAddress);
```

*   **data**: Factory-specific encoded parameters
    *   `L1TokenFactory`: `abi.encode(tokenURI)`
    *   `L2SuperChainTokenFactory`: `abi.encode(bridge, remoteToken, tokenURI)`
*   **salt**: Used with CREATE2 for deterministic address derivation


Extensibility
-------------

New token factories can inherit from `BaseTokenFactory` to gain fee management, promo code support, UUPS upgradeability, and deterministic deployment out of the box, while implementing custom token creation logic.

License
-------

MIT

Usage
-----

### Compile and Run Tests

```bash
cd contracts
forge install
forge build
forge test
```

### Formatting

```bash
forge fmt
```

Deployment Addresses
--------------------

### L1TokenFactory (Ethereum)

| Network | Proxy Address | Implementation |
|---------|--------------|----------------|
| Ethereum Mainnet | `0x1b23dce73c327f8e07e45fe3a1605dafd8286ab4` | `0xfefbf0eac7562598c6f00e9fed6e1d256acefc52` |
| Sepolia | `0xf87ea3325c6f5be2119d40747752bb255cdf1ee8` | `0x1adc588afd3e635c95c1efa71790cfe3408ca410` |

### L2SuperChainTokenFactory (Celo)

| Network | Proxy Address | Implementation |
|---------|--------------|----------------|
| Celo Mainnet | `0x1b23dce73c327f8e07e45fe3a1605dafd8286ab4` | `0x8c82a00b5aae0b6624bead9982db7028145c7714` |
| Celo Alfajores (testnet) | see `contracts/broadcast/` | — |

### Shared Infrastructure (same address on all networks)

| Contract | Address |
|----------|---------|
| FactoryInitializer | `0xb30e5525b8eb7969cda4c7dec893d2856cfe6f18` |
| TokenInitializer | `0xc35410f3536f453dc0ae23ed0c85cb3dab081211` |

Audits
------

No external audits have been completed yet. See [contracts/docs/SECURITY.md](contracts/docs/SECURITY.md) for the threat model, trust assumptions, and known attack vectors.
