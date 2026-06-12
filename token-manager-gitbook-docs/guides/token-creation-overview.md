# Token Creation Flows Overview

Three flows, available in the UI and replicable via [REST API](../developers/agent-rest-api.md) or [MCP](../developers/mcp-server.md).

| Flow | What it does | Best for |
| ---- | ------------ | -------- |
| [**Celo Native**](celo-native-token.md) | Token on Celo L2 only | Community tokens, local currencies, low cost |
| [**Ethereum Enabled**](ethereum-enabled-token.md) | Token on L1 + L2, linked via bridge | Ethereum DeFi access, cross-chain projects |
| [**L2→L1 Migration**](l2-to-l1-migration.md) | Add an L1 counterpart to an existing Celo token | Celo projects expanding to Ethereum |

| Flow | Steps | Fee | Time |
| ---- | ----- | --- | ---- |
| Celo Native | 1 | \~0.001 CELO | \~5 sec |
| Ethereum Enabled | 4–5 | \~0.01 ETH | \~2 min + 20 min bridge |
| L2→L1 Migration | 3–4 | \~0.01 ETH | \~2 min + bridge |

{% hint style="info" %}
All flows support [promo codes](promo-codes.md) for reduced or free creation.
{% endhint %}
