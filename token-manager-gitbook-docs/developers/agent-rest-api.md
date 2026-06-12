# Agent REST API

REST endpoints that generate transaction calldata for token creation and bridging. The backend never holds keys — you sign and broadcast.

**Base URL:** `http://localhost:3001`

## Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/tokens/chains` | Supported chains, factory addresses, ABIs |
| GET | `/api/tokens/:chainId/fee` | Current creation fee |
| POST | `/api/tokens/:chainId/create/calldata` | Calldata for one token |
| POST | `/api/tokens/:chainId/create-with-bridge/calldata` | Calldata for L2 token with bridge |
| POST | `/api/tokens/bridge/calldata` | Calldata for bridging L1→L2 |
| POST | `/api/tokens/full-deployment/calldata` | Complete multi-step deployment plan |
| POST | `/api/metadata/pin` | Pin metadata to IPFS |
| POST | `/api/metadata/pin-with-image` | Pin metadata + image |
| GET | `/api/metadata/:cid` | Fetch metadata from IPFS |

## Create a token (single chain)

```bash
POST /api/tokens/42220/create/calldata
{
  "owner": "0x...", "name": "My Token", "symbol": "MTK",
  "decimals": 18, "initialSupply": "1000000", "maxSupply": "10000000",
  "metadataURI": "ipfs://Qm...", "promoCode": "LAUNCH2024"
}
```

Response includes everything needed to send: `to`, `data`, `value`, `gasLimit`, `rpcUrl`, plus echoed params with wei conversions.

## Full deployment plan

```bash
POST /api/tokens/full-deployment/calldata
{ "tokenType": "ethereum-enabled", ..., "bridgeInitialSupply": true }
```

* `celo-native` → 1 step
* `ethereum-enabled` → up to 4 steps: create L1 → create L2 with bridge → approve → bridge supply. Step 2 contains a `{L1_TOKEN_ADDRESS}` placeholder — replace it with the address from step 1's `TokenCreated` event.

## Integration pattern

1. `GET /api/tokens/chains` to discover config
2. `POST /api/metadata/pin` for IPFS metadata
3. `POST .../create/calldata` for the transaction
4. Sign and broadcast with your wallet
5. Parse `TokenCreated` from the receipt → [Events & Receipts](events-and-receipts.md)

## Errors

```json
{ "success": false, "error": "Description", "details": [ ... ] }
```

`400` invalid params/promo · `404` not found · `500` server error. No rate limits enforced yet — add your own in production.
