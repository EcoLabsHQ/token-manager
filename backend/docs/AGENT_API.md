# Token Creation API for Agents

This document describes the REST API endpoints that allow AI agents and external systems to generate transaction calldata for creating and managing tokens on Celo and Ethereum.

## Base URL

```
http://localhost:3001/api/tokens
```

## Endpoints

### 1. Get Supported Chains

```http
GET /api/tokens/chains
```

Returns all supported chains with their configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "chains": [
      {
        "chainId": 42220,
        "name": "Celo",
        "symbol": "CELO",
        "type": "L2",
        "rpcUrl": "https://forno.celo.org",
        "explorerUrl": "https://celoscan.io",
        "factoryType": "L2SuperChainTokenFactory",
        "factoryAddress": { "l2": "0x..." }
      }
    ],
    "factoryABIs": { ... }
  }
}
```

---

### 2. Get Creation Fee

```http
GET /api/tokens/:chainId/fee
```

Returns the current creation fee for a specific chain.

**Parameters:**
- `chainId` (path): Chain ID (42220 for Celo, 1 for Ethereum)

**Response:**
```json
{
  "success": true,
  "data": {
    "chainId": 42220,
    "factoryAddress": "0x...",
    "creationFee": "1000000000000000",
    "creationFeeFormatted": "0.001",
    "nativeSymbol": "CELO"
  }
}
```

---

### 3. Generate Token Creation Calldata

```http
POST /api/tokens/:chainId/create/calldata
```

Generates calldata for creating a token on a specific chain.

**Parameters:**
- `chainId` (path): Chain ID

**Request Body:**
```json
{
  "owner": "0x...",
  "name": "My Token",
  "symbol": "MTK",
  "decimals": 18,
  "initialSupply": "1000000",
  "maxSupply": "10000000",
  "metadataURI": "ipfs://Qm...",
  "promoCode": "LAUNCH2024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chainId": 42220,
    "to": "0x...",
    "data": "0x...",
    "value": "1000000000000000",
    "valueFormatted": "0.001",
    "functionName": "createToken",
    "gasLimit": "500000",
    "rpcUrl": "https://forno.celo.org",
    "explorerUrl": "https://celoscan.io",
    "promoData": null,
    "params": {
      "owner": "0x...",
      "name": "My Token",
      "symbol": "MTK",
      "decimals": 18,
      "initialSupply": "1000000",
      "initialSupplyWei": "1000000000000000000000000",
      "maxSupply": "10000000",
      "maxSupplyWei": "10000000000000000000000000",
      "metadataURI": "ipfs://Qm..."
    }
  }
}
```

---

### 4. Generate Full Deployment Calldata

```http
POST /api/tokens/full-deployment/calldata
```

Generates all calldata needed for a complete token deployment. For `celo-native` tokens, this is a single step. For `ethereum-enabled` tokens, this includes L1 creation, L2 creation with bridge, and optional bridging of initial supply.

**Request Body:**
```json
{
  "tokenType": "celo-native",
  "owner": "0x...",
  "name": "My Token",
  "symbol": "MTK",
  "decimals": 18,
  "initialSupply": "1000000",
  "maxSupply": "10000000",
  "metadataURI": "ipfs://Qm...",
  "promoCode": "LAUNCH2024",
  "bridgeInitialSupply": true
}
```

**Token Types:**
- `celo-native`: Creates a token only on Celo L2 (1 step)
- `ethereum-enabled`: Creates tokens on both L1 and L2 with bridge support (2-4 steps)

**Response for celo-native:**
```json
{
  "success": true,
  "data": {
    "tokenType": "celo-native",
    "totalSteps": 1,
    "steps": [
      {
        "step": 1,
        "description": "Create L2 token on Celo",
        "chainId": 42220,
        "chainName": "Celo",
        "to": "0x...",
        "data": "0x...",
        "value": "1000000000000000",
        "functionName": "createToken",
        "gasLimit": "500000"
      }
    ]
  }
}
```

**Response for ethereum-enabled:**
```json
{
  "success": true,
  "data": {
    "tokenType": "ethereum-enabled",
    "totalSteps": 4,
    "steps": [
      {
        "step": 1,
        "description": "Create L1 token on Ethereum",
        "chainId": 1,
        "to": "0x...",
        "data": "0x...",
        "value": "...",
        "expectedResult": "L1 token address will be in TokenCreated event"
      },
      {
        "step": 2,
        "description": "Create L2 token on Celo with bridge link",
        "chainId": 42220,
        "dataParams": {
          "function": "createTokenWithBridge",
          "args": ["...", "{L1_TOKEN_ADDRESS}", "..."]
        },
        "note": "Replace {L1_TOKEN_ADDRESS} with address from step 1"
      },
      {
        "step": 3,
        "description": "Approve bridge to spend L1 tokens",
        "chainId": 1
      },
      {
        "step": 4,
        "description": "Bridge initial supply to L2",
        "chainId": 1
      }
    ]
  }
}
```

---

### 5. Generate Bridge Calldata

```http
POST /api/tokens/bridge/calldata
```

Generates calldata for bridging tokens from L1 to L2.

**Request Body:**
```json
{
  "l1TokenAddress": "0x...",
  "l2TokenAddress": "0x...",
  "recipient": "0x...",
  "amount": "1000",
  "decimals": 18
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "steps": [
      {
        "step": 1,
        "description": "Approve bridge to spend tokens",
        "to": "0x...",
        "data": "0x..."
      },
      {
        "step": 2,
        "description": "Bridge tokens to L2",
        "to": "0x...",
        "data": "0x..."
      }
    ]
  }
}
```

---

## Complete Flow Example

### Creating a Celo-Native Token

```bash
# 1. Pin metadata to IPFS
curl -X POST http://localhost:3001/api/metadata/pin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "description": "A community token"
  }'

# Response: { "data": { "metadataURI": "ipfs://Qm..." } }

# 2. Generate calldata
curl -X POST http://localhost:3001/api/tokens/42220/create/calldata \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "0xYourAddress",
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "initialSupply": "1000000",
    "maxSupply": "0",
    "metadataURI": "ipfs://Qm..."
  }'

# Response includes: { "to": "0x...", "data": "0x...", "value": "..." }

# 3. Sign and send the transaction using your wallet/agent
```

### Creating an Ethereum-Enabled Token

```bash
# 1. Pin metadata (same as above)

# 2. Get full deployment plan
curl -X POST http://localhost:3001/api/tokens/full-deployment/calldata \
  -H "Content-Type: application/json" \
  -d '{
    "tokenType": "ethereum-enabled",
    "owner": "0xYourAddress",
    "name": "Bridge Token",
    "symbol": "BRG",
    "decimals": 18,
    "initialSupply": "1000000",
    "maxSupply": "10000000",
    "metadataURI": "ipfs://Qm...",
    "bridgeInitialSupply": true
  }'

# 3. Execute each step in order:
#    - Step 1: Create L1 token → Extract L1 address from event
#    - Step 2: Create L2 token with L1 address → Extract L2 address
#    - Step 3: Approve bridge
#    - Step 4: Bridge tokens
```

---

## Using with AI Agents

### MCP (Model Context Protocol)

For AI agents that support MCP, connect to:
```
http://localhost:3001/mcp
```

See [MCP README](../src/mcp/README.md) for full documentation.

### REST API Integration

For other agents, use the REST endpoints directly. The agent should:

1. Call `/api/tokens/chains` to discover supported chains
2. Call `/api/metadata/pin` to upload metadata to IPFS
3. Call `/api/tokens/:chainId/create/calldata` to get transaction data
4. Sign and broadcast the transaction using its wallet
5. Parse the `TokenCreated` event from the transaction receipt to get the token address

### Extracting Token Address from Events

After executing a token creation transaction, the token address is emitted in the `TokenCreated` event:

```solidity
event TokenCreated(
    address indexed tokenAddress,
    address indexed owner,
    string name,
    string symbol,
    uint8 decimals,
    uint256 initialSupply,
    uint256 maxSupply,
    string metadataURI
);
```

Use ethers.js or viem to decode this event from the transaction receipt.

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error description",
  "details": [ ... ]
}
```

Common errors:
- `400`: Invalid parameters or promo code issues
- `404`: Resource not found
- `500`: Server error

---

## Rate Limits

Currently no rate limits are enforced. For production, consider implementing rate limiting per IP or API key.
