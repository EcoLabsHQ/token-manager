# Token Manager — AI Agent Guide

This guide describes how AI agents can interact with **Token Manager** to create and manage ERC-20 tokens on Celo and Ethereum, using the MCP server or the REST API.

---

## Project Overview

Token Manager is a platform for deploying and managing ERC-20 tokens on:

- **Celo L2** — Fast, low-cost token deployment (Celo native)
- **Ethereum L1 + Celo L2** — Tokens with cross-chain bridge support (Ethereum Enabled)

Agents can interact through two interfaces:

| Interface | When to use |
|-----------|-------------|
| **MCP Server** | Agents compatible with Model Context Protocol (Claude, Copilot, Cline, etc.) |
| **REST API** | Any programmatic system, scripts, CI/CD pipelines |

---

## Option 1: MCP Server

### Configuration

**HTTP (recommended — requires backend running):**

```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp",
      "transport": "http"
    }
  }
}
```

**stdio (local development without HTTP server):**

```json
{
  "mcpServers": {
    "token-minter": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/minter/backend"
    }
  }
}
```

**VS Code (`.vscode/mcp.json`):**

```json
{
  "servers": {
    "token-minter": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### Available Tools

#### Discovery

| Tool | Description |
|------|-------------|
| `get_supported_chains` | List supported chains with chain IDs, factory addresses, and RPC URLs |
| `get_token_creation_params` | Parameters and ABI for creating a token on a specific chain |

#### Token Querying

| Tool | Description |
|------|-------------|
| `list_tokens` | List all created tokens (supports pagination and sorting) |
| `get_token_details` | Token details: holders, transfers, metadata |
| `get_tokens_by_owner` | All tokens belonging to an address |

#### Metadata & IPFS

| Tool | Description |
|------|-------------|
| `pin_token_metadata` | Upload ERC-7572 metadata to IPFS via Pinata |
| `get_token_metadata` | Retrieve metadata from IPFS using an `ipfs://...` URI |

#### Promo Codes

| Tool | Description |
|------|-------------|
| `validate_promo_code` | Validate a promo code and return the signature for discounted creation |

#### Logos

| Tool | Description |
|------|-------------|
| `get_token_logo` | Get the logo URL of a token |
| `list_token_logos` | List all tokens with a logo on a chain |

#### Transaction Building

| Tool | Description |
|------|-------------|
| `build_create_token_transaction` | Generate calldata for creating a token (supports promoCode for automatic validation) |

#### On-Chain Reads

| Tool | Description |
|------|-------------|
| `get_creation_fee` | Query the current token creation fee from the factory contract |

#### Wallet & Transaction

| Tool | Description |
|------|-------------|
| `get_wallet_balance` | Get native token balance (CELO/ETH) of a wallet address |
| `estimate_gas` | Simulate a transaction and get estimated gas with safety buffer |
| `get_transaction_status` | Get status and receipt of a transaction; extracts token address from TokenCreated event |

---

## Option 2: REST API

**Base URL:** `http://localhost:3001/api`

### Main Endpoints

```
GET  /api/tokens/chains                               — Supported chains
GET  /api/tokens/:chainId/fee                         — Creation fee
POST /api/tokens/:chainId/create/calldata             — Calldata to create a token
POST /api/tokens/:chainId/create-with-bridge/calldata — Calldata for bridged token
POST /api/tokens/bridge/calldata                      — Calldata for L1→L2 bridge
POST /api/tokens/full-deployment/calldata             — All calldata for a full deployment
POST /api/metadata/pin                                — Upload metadata to IPFS
POST /api/metadata/pin-with-image                     — Upload metadata + image to IPFS
GET  /api/metadata/:cid                               — Retrieve metadata from IPFS
POST /api/promo/validate                              — Validate promo code
GET  /api/promo/check/:code                           — Check code without consuming it
```

---

## Token Creation Flows

### Flow 1: Celo Native Token (simplest)

For tokens that only operate on Celo L2.

```
1. [Optional] Upload logo  →  POST /api/tokens/:chainId/pre-upload/:hash/logo
2. Pin metadata to IPFS    →  POST /api/metadata/pin
3. Generate calldata       →  POST /api/tokens/42220/create/calldata
4. Sign and send tx        →  The agent uses its wallet to send the transaction
5. Copy logo               →  POST /api/tokens/:chainId/:address/logo/copy
```

**Quick REST example:**

```bash
# Step 1: Pin metadata
curl -X POST http://localhost:3001/api/metadata/pin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "description": "A community governance token"
  }'
# → { "data": { "metadataURI": "ipfs://Qm..." } }

# Step 2: Get calldata
curl -X POST http://localhost:3001/api/tokens/42220/create/calldata \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "0xYourAddress",
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "initialSupply": "1000000",
    "maxSupply": "10000000",
    "metadataURI": "ipfs://Qm..."
  }'
# → { "data": { "to": "0x...", "data": "0x...", "value": "1000000000000000" } }
```

**MCP example:**

```
1. Call get_supported_chains            →  Get chainId and factory address
2. Call get_wallet_balance              →  Check if wallet has enough funds
3. Call get_creation_fee                →  Get current fee for token creation
4. Call pin_token_metadata              →  Get metadataURI
5. Call build_create_token_transaction  →  Get ready-to-sign transaction (with chainId=42220)
6. Sign and send the transaction with the agent's wallet
7. Call get_transaction_status          →  Get the new token address from the receipt
```

---

### Flow 2: Ethereum Enabled Token (with bridge)

For tokens that operate on both Ethereum L1 and Celo L2.

```
Step 1: Create token on Ethereum L1    → chainId=1
Step 2: Create token on Celo L2        → chainId=42220 (with l1TokenAddress from step 1)
Step 3: [Optional] Bridge supply L1→L2 → POST /api/tokens/bridge/calldata
```

**Shortcut — Full Deployment:**

```bash
curl -X POST http://localhost:3001/api/tokens/full-deployment/calldata \
  -H "Content-Type: application/json" \
  -d '{
    "tokenType": "ethereum-enabled",
    "owner": "0xYourAddress",
    "name": "My Token",
    "symbol": "MTK",
    "decimals": 18,
    "initialSupply": "1000000",
    "maxSupply": "10000000",
    "metadataURI": "ipfs://Qm...",
    "bridgeInitialSupply": true
  }'
```

Returns an array of steps (`steps`), each with calldata, chainId, and description. The agent must execute them **in order**.

---

### Flow 3: L2 → L1 Migration

For migrating an existing Celo token to Ethereum.

```
1. Get info of the existing token on Celo
2. Create equivalent token on Ethereum L1  →  POST /api/tokens/1/create/calldata
3. Configure the bridge between L1 and L2
4. [Optional] Bridge initial supply        →  POST /api/tokens/bridge/calldata
```

---

## Using Promo Codes

Promo codes allow creating tokens at a discount or for free.

```bash
# Check if valid (without consuming it)
curl http://localhost:3001/api/promo/check/LAUNCH2024

# Validate and get signature (consumes it if single-use)
curl -X POST http://localhost:3001/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "LAUNCH2024",
    "userAddress": "0xYourAddress",
    "chainId": 42220
  }'
# → { "data": { "signature": "0x...", "promoFee": "0", "nonce": "...", "expiresAt": 1234567890 } }
```

Include the `promoFee`, `promoNonce`, `expiresAt`, and `signature` fields in the token creation call.

---

## Querying Existing Tokens

```bash
# List tokens on Celo
curl "http://localhost:3001/api/tokens/42220?first=10&skip=0"

# Details of a specific token
curl "http://localhost:3001/api/tokens/42220/0xTokenAddress"
```

With MCP:
```
list_tokens(chainId=42220, first=10, orderBy="createdAt", orderDirection="desc")
get_token_details(chainId=42220, tokenAddress="0x...")
get_tokens_by_owner(chainId=42220, ownerAddress="0x...")
```

---

## Agent Requirements

To create tokens, the agent needs:

1. **Funded wallet** — To pay creation fees (~0.001 CELO on Celo)
2. **Backend access** — `http://localhost:3001` running locally or in production
3. **Transaction signing capability** — The backend generates the calldata; the agent signs and sends

---

## Running the Backend Locally

```bash
cd backend
npm install
cp .env.example .env
# Configure: DATABASE_URL, PROMO_SIGNER_PRIVATE_KEY, ADMIN_API_KEY, PINATA_JWT

# Initialize database
psql -d minter -f schema.sql

# Start server
npm run dev        # Port 3001

# Or just the MCP server (stdio)
npm run mcp
```

---

## Chain ID Reference

| Network | Chain ID | Type |
|---------|----------|------|
| Ethereum Mainnet | `1` | L1 |
| Celo | `42220` | L2 |
| Ethereum Sepolia | `11155111` | L1 Testnet |
| Celo Alfajores | `44787` | L2 Testnet |

---

## Additional Documentation

- [Token Creation Flows](docs/TOKEN_CREATION_FLOWS.md) — Detailed diagrams for each flow
- [Full REST API for Agents](backend/docs/AGENT_API.md) — Complete endpoint reference
- [MCP Server](backend/src/mcp/README.md) — Full MCP server documentation
- [Smart Contracts](contracts/README.md) — Contract architecture and deployment
- [Subgraph](subgraph/README.md) — GraphQL API for querying tokens
