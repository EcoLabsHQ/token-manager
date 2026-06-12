# Flow 1: Celo Native Token

The simplest flow — one token, one chain, one signature. Usable immediately in the Celo ecosystem.

## UI steps

1. Select "Celo Native"
2. Fill in name, symbol, decimals, supply, logo
3. Review and sign

## What happens behind the scenes

| Step | Action |
| ---- | ------ |
| 1 | (Optional) Logo uploaded to CDN under a temporary hash |
| 2 | Metadata pinned to IPFS (ERC-7572 JSON) → `ipfs://Qm...` |
| 3 | `L2SuperChainTokenFactory.createToken()` on Celo (42220) — deploys proxy, mints supply, emits `TokenCreated` |
| 4 | Logo copied from temp hash to the real token address |

## API example

```bash
# 1. Pin metadata
curl -X POST http://localhost:3001/api/metadata/pin \
  -H "Content-Type: application/json" \
  -d '{ "name": "Community Token", "symbol": "COMM", "decimals": 18 }'
# → { "data": { "metadataURI": "ipfs://Qm..." } }

# 2. Get calldata
curl -X POST http://localhost:3001/api/tokens/42220/create/calldata \
  -H "Content-Type: application/json" \
  -d '{ "owner": "0xYou", "name": "Community Token", "symbol": "COMM",
        "decimals": 18, "initialSupply": "1000000", "maxSupply": "0",
        "metadataURI": "ipfs://Qm..." }'
# → { "data": { "to": "0x...", "data": "0x...", "value": "..." } }

# 3. Sign and send with your wallet
```

## MCP example

```
User: "Create 'Community Token' (COMM) on Celo with 1M supply"
Agent: pin_token_metadata → build_create_token_transaction → returns tx to sign
```

After sending, get the token address from the `TokenCreated` event — see [Events & Receipts](../developers/events-and-receipts.md).
