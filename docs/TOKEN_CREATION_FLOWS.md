# Token Creation Flows

This document describes the different token creation flows available in the Token Minter UI and how to replicate them programmatically via the API or MCP.

## Overview

The minter supports three main token creation flows:

| Flow | Description | Chains Involved |
|------|-------------|-----------------|
| **Celo Native** | Create a token only on Celo L2 | Celo |
| **Ethereum Enabled** | Create token on L1 + L2 with bridge support | Ethereum + Celo |
| **L2 to L1 Migration** | Migrate existing Celo token to Ethereum | Celo → Ethereum |

---

## Flow 1: Create Token on L2 (Celo Native)

This is the simplest flow. The token is created only on Celo L2 and can be used immediately within the Celo ecosystem.

### Use Case
- Community tokens
- Local currencies
- Tokens that don't need Ethereum liquidity
- Cost-effective token creation

### UI Steps

1. **Select Token Type**: Choose "Celo Native"
2. **Fill Token Info**: Name, symbol, decimals, initial/max supply, logo
3. **Review**: Verify token parameters
4. **Deploy**: Sign transaction to create token on Celo

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WALLET                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Upload Logo (Optional)                                 │
│  POST /api/tokens/:chainId/pre-upload/:hash/logo                │
│  - Uploads logo to CDN with temporary hash identifier           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Pin Metadata to IPFS                                   │
│  POST /api/metadata/pin                                         │
│  - Creates ERC-7572 compliant metadata JSON                     │
│  - Returns: ipfs://Qm... URI                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Create Token on Celo L2                                │
│  L2SuperChainTokenFactory.createToken()                         │
│  Chain: Celo (42220)                                            │
│  Fee: ~0.001 CELO                                               │
│  - Deploys L2SuperChainToken proxy                              │
│  - Mints initial supply to owner                                │
│  - Emits TokenCreated event with token address                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Copy Logo to Token Address                             │
│  POST /api/tokens/:chainId/:address/logo/copy                   │
│  - Copies logo from temp hash to real token address             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        ✅ TOKEN CREATED
                        Address: 0x...
```

### API Example

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
# Response: { "data": { "metadataURI": "ipfs://Qm..." } }

# Step 2: Get calldata
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
# Response: { "data": { "to": "0x...", "data": "0x...", "value": "..." } }

# Step 3: Sign and send transaction with your wallet
```

### MCP Example

```
User: "Create a token called 'Community Token' with symbol 'COMM' on Celo with 1 million supply"

Agent:
1. Calls pin_token_metadata → Gets ipfs://Qm...
2. Calls build_create_token_transaction → Gets transaction data
3. Returns transaction for user to sign
```

### Contract Interaction

```solidity
// L2SuperChainTokenFactory on Celo
function createToken(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    string memory metadataURI_
) external payable returns (address tokenAddress);
```

---

## Flow 2: Create Token on L1 with L2 and Bridge (Ethereum Enabled)

This flow creates a token on Ethereum L1 first, then creates a bridged counterpart on Celo L2. The tokens are linked via the OP Stack standard bridge, allowing tokens to move between chains.

### Use Case
- Tokens that need Ethereum DeFi access
- Cross-chain projects
- Tokens requiring both L1 security and L2 scalability
- Projects that want to tap into both ecosystems

### UI Steps

1. **Select Token Type**: Choose "Ethereum Enabled"
2. **Fill Token Info**: Name, symbol, decimals, initial/max supply, logo
3. **Review**: Verify token parameters
4. **Deploy L1**: Sign transaction to create token on Ethereum
5. **Deploy L2**: Sign transaction to create bridged token on Celo
6. **Configure Bridge**: Automatically sets up bridge addresses
7. **Bridge Tokens** (Optional): Sign approve + bridge transactions to move initial supply to L2

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WALLET                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Upload Logo + Pin Metadata (same as Flow 1)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Create Token on Ethereum L1                            │
│  L1TokenFactory.createToken()                                   │
│  Chain: Ethereum (1)                                            │
│  Fee: ~0.01 ETH                                                 │
│  - Deploys L1Token proxy                                        │
│  - Mints initial supply to owner                                │
│  - Emits TokenCreated event → L1_TOKEN_ADDRESS                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Create Bridged Token on Celo L2                        │
│  L2SuperChainTokenFactory.createTokenWithBridge()               │
│  Chain: Celo (42220)                                            │
│  Fee: FREE (already paid on L1)                                 │
│  Parameters:                                                    │
│  - bridge_: 0x4200000000000000000000000000000000000010 (L2Bridge)│
│  - remoteToken_: L1_TOKEN_ADDRESS (from Step 2)                 │
│  - Deploys L2SuperChainToken with bridge config                 │
│  - Emits TokenCreated event → L2_TOKEN_ADDRESS                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Approve Bridge (if bridging initial supply)            │
│  L1Token.approve(L1_BRIDGE, amount)                             │
│  Chain: Ethereum (1)                                            │
│  - Allows bridge to transfer tokens                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Bridge Tokens to L2                                    │
│  L1StandardBridge.bridgeERC20To()                               │
│  Chain: Ethereum (1)                                            │
│  - Burns tokens on L1                                           │
│  - Triggers mint on L2 (after ~15-20 min)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        ✅ TOKEN CREATED
                        L1 Address: 0x...
                        L2 Address: 0x...
                        Tokens bridged to L2
```

### API Example

```bash
# Get full deployment plan
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

# Response contains 4 steps:
# Step 1: Create L1 token
# Step 2: Create L2 token with bridge
# Step 3: Approve bridge
# Step 4: Bridge tokens
```

### Contract Interactions

```solidity
// Step 2: L1TokenFactory on Ethereum
function createToken(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    string memory metadataURI_
) external payable returns (address tokenAddress);

// Step 3: L2SuperChainTokenFactory on Celo (NO FEE)
function createTokenWithBridge(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    address bridge_,        // 0x4200000000000000000000000000000000000010
    address remoteToken_,   // L1 token address from step 2
    string memory metadataURI_
) external returns (address tokenAddress);

// Step 4: L1Token
function approve(address spender, uint256 amount) external returns (bool);

// Step 5: L1StandardBridge on Ethereum
function bridgeERC20To(
    address _localToken,   // L1 token address
    address _remoteToken,  // L2 token address
    address _to,           // Recipient on L2
    uint256 _amount,
    uint32 _minGasLimit,   // 200000 recommended
    bytes calldata _extraData
) external;
```

### Bridge Addresses

| Contract | Address |
|----------|---------|
| L1 Standard Bridge | `0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe` |
| L2 Standard Bridge | `0x4200000000000000000000000000000000000010` |

---

## Flow 3: Migrate L2 Token to L1

This flow allows migrating an existing Celo L2 token to have an L1 counterpart on Ethereum, enabling bridging capabilities for tokens that were originally created as "Celo Native".

### Use Case
- Existing L2 tokens that now need Ethereum access
- Projects that started on Celo and want to expand
- Tokens that need to access Ethereum DeFi

### UI Steps

1. **Select Token**: Choose existing L2 token to migrate
2. **Review**: Verify token details
3. **Create L1 Token**: Sign transaction on Ethereum to create L1 counterpart
4. **Configure L2 Token**: Sign transaction on Celo to set bridge and remote token
5. **Bridge Tokens** (Optional): Move tokens between chains

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXISTING L2 TOKEN                           │
│                     Address: 0xL2Token...                       │
│                     Chain: Celo (42220)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Create L1 Token on Ethereum                            │
│  L1TokenFactory.createToken()                                   │
│  Chain: Ethereum (1)                                            │
│  - Use same name, symbol, decimals                              │
│  - initialSupply: 0 (supply stays on L2)                        │
│  - Emits TokenCreated → L1_TOKEN_ADDRESS                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Configure L2 Token for Bridge                          │
│  L2SuperChainToken.setBridge(L2_BRIDGE)                         │
│  Chain: Celo (42220)                                            │
│  - Must be called by token owner                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Set Remote Token                                       │
│  L2SuperChainToken.setRemoteToken(L1_TOKEN_ADDRESS)             │
│  Chain: Celo (42220)                                            │
│  - Links L2 token to its L1 counterpart                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4 (Optional): Bridge Tokens to L1                         │
│  L2StandardBridge.bridgeERC20To()                               │
│  Chain: Celo (42220)                                            │
│  - Burns tokens on L2                                           │
│  - Mints on L1 after bridge finalization                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        ✅ MIGRATION COMPLETE
                        L1 Address: 0x...
                        L2 Address: 0x... (existing)
                        Tokens can now bridge both ways
```

### Contract Interactions

```solidity
// Step 1: L1TokenFactory on Ethereum
function createToken(...) external payable returns (address);

// Step 2: L2SuperChainToken on Celo (owner only)
function setBridge(address bridge_) external onlyOwner;

// Step 3: L2SuperChainToken on Celo (owner only)
function setRemoteToken(address remoteToken_) external onlyOwner;

// Step 4: L2StandardBridge on Celo (for L2→L1 bridging)
function bridgeERC20To(
    address _localToken,   // L2 token address
    address _remoteToken,  // L1 token address
    address _to,           // Recipient on L1
    uint256 _amount,
    uint32 _minGasLimit,
    bytes calldata _extraData
) external;
```

### Important Notes

1. **Owner Only**: Steps 2-3 require the token owner to sign
2. **Bridge Direction**: After migration, tokens can bridge both L1→L2 and L2→L1
3. **Supply**: Initial supply remains on L2; L1 starts with 0 supply
4. **Irreversible**: Once configured, bridge settings cannot be changed

---

## Promo Codes

All flows support promotional codes that reduce or eliminate creation fees.

### Applying Promo Code

```bash
# Validate promo code
curl -X POST http://localhost:3001/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "LAUNCH2024",
    "userAddress": "0x...",
    "chainId": 42220,
    "factoryAddress": "0x..."
  }'

# Response includes signature data for createTokenWithPromo
```

### Contract Function

```solidity
function createTokenWithPromo(
    address owner_,
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    uint256 maxSupply_,
    string memory metadataURI_,
    uint256 promoFee_,
    bytes32 promoNonce_,
    uint256 expiresAt_,
    bytes memory signature_
) external payable returns (address tokenAddress);
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `InsufficientFee` | Value sent < creationFee | Send correct fee amount |
| `InvalidOwner` | owner_ is zero address | Provide valid owner |
| `InvalidSupply` | initialSupply > maxSupply | Fix supply values |
| `InvalidSignature` | Bad promo signature | Refresh promo validation |
| `PromoExpired` | Promo code expired | Use different code |

### Transaction Failures

1. **Gas estimation fails**: Increase gas limit to 600000
2. **Reverted**: Check all parameters are valid
3. **Chain switch fails**: Manually switch network and retry

---

## Events

Listen for these events to track token creation:

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

### Extracting Token Address from Receipt

```typescript
import { decodeEventLog } from 'viem';

const receipt = await publicClient.waitForTransactionReceipt({ hash });

for (const log of receipt.logs) {
  try {
    const event = decodeEventLog({
      abi: L2SuperChainTokenFactoryABI,
      data: log.data,
      topics: log.topics,
    });
    
    if (event.eventName === 'TokenCreated') {
      console.log('Token address:', event.args.tokenAddress);
    }
  } catch {}
}
```

---

## Summary

| Flow | Steps | Chains | Fee | Time |
|------|-------|--------|-----|------|
| Celo Native | 1 | Celo | ~0.001 CELO | ~5 sec |
| Ethereum Enabled | 4-5 | ETH + Celo | ~0.01 ETH | ~2 min + 20 min bridge |
| L2→L1 Migration | 3-4 | ETH + Celo | ~0.01 ETH | ~2 min + bridge time |
