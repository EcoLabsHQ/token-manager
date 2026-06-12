# MCP Server

A Model Context Protocol server that lets AI agents create tokens, manage IPFS metadata, query tokens, and build transaction calldata on Celo and Ethereum.

**Endpoint:** `POST http://localhost:3001/mcp`

## Configuration

{% tabs %}
{% tab title="HTTP (Claude Desktop, Cursor, Cline)" %}
```json
{
  "mcpServers": {
    "token-minter": { "url": "http://localhost:3001/mcp", "transport": "http" }
  }
}
```
{% endtab %}

{% tab title="stdio (local dev)" %}
```json
{
  "mcpServers": {
    "token-minter": {
      "command": "npm", "args": ["run", "mcp"],
      "cwd": "/path/to/token-manager/backend"
    }
  }
}
```
{% endtab %}
{% endtabs %}

## Typical flow

1. `get_supported_chains` → 2. `get_wallet_balance` → 3. `get_creation_fee` → 4. `pin_token_metadata` → 5. `validate_promo_code` (optional) → 6. `build_create_token_transaction` → 7. sign & send → 8. `get_transaction_status` (returns the token address)

## Tools

| Category | Tool | Purpose |
| -------- | ---- | ------- |
| Discovery | `get_supported_chains` | Chains, factory addresses, RPC URLs |
| | `get_token_creation_params` | Parameters + ABI per chain |
| Query | `list_tokens` | Tokens on a chain (pagination, ordering) |
| | `get_token_details` | Token info, holders, transfers |
| | `get_tokens_by_owner` | Tokens owned by an address |
| Metadata | `pin_token_metadata` | Pin ERC-7572 JSON (+ image) to IPFS |
| | `get_token_metadata` | Fetch from IPFS by URI/CID |
| Promo | `validate_promo_code` | Get signature for discounted creation |
| Logos | `get_token_logo` / `list_token_logos` | Logo URLs |
| Transactions | `build_create_token_transaction` | Ready-to-sign tx; accepts `promoCode` |
| On-chain | `get_creation_fee` | Current fee from the factory contract |
| Wallet | `get_wallet_balance` | CELO/ETH balance check |
| | `estimate_gas` | Gas estimate + 20% buffer |
| | `get_transaction_status` | Receipt + created token address |

**Common arguments:** `chainId` is 42220 (Celo) or 1 (Ethereum). `build_create_token_transaction` requires `chainId`, `owner`, `name`, `symbol`, `initialSupply`, `metadataURI`; `decimals` defaults to 18, `maxSupply` to "0" (unlimited).
