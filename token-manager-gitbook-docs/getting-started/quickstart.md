# Quickstart

## Token creator (UI)

1. Pick a token type: **Celo Native** or **Ethereum Enabled**
2. Fill in name, symbol, decimals, supply, logo
3. Review and sign the transaction(s)

Details: [Token Creation Flows](../guides/token-creation-overview.md).

## AI agent (MCP)

```json
{
  "mcpServers": {
    "token-minter": { "url": "http://localhost:3001/mcp" }
  }
}
```

The agent pins metadata, builds the transaction, and hands it back for signing. Tool list: [MCP Server](../developers/mcp-server.md).

## Developer (REST API)

```bash
POST /api/tokens/full-deployment/calldata
{ "tokenType": "celo-native", "owner": "0x...", "name": "My Token", "symbol": "MTK", "initialSupply": "1000000" }
```

Returns ready-to-sign calldata. Reference: [Agent REST API](../developers/agent-rest-api.md).

## Flow comparison

| Flow | Chains | Time |
| ---- | ------ | ---- |
| Celo Native | Celo | \~5 sec |
| Ethereum Enabled | ETH + Celo | \~2 min + 20 min bridge |
| L2→L1 Migration | ETH + Celo | \~2 min + bridge |
