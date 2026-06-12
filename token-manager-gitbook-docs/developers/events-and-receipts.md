# Events & Receipts

Both factories emit `TokenCreated` — this is where you get the new token's address.

```solidity
event TokenCreated(
    address indexed tokenAddress,
    address indexed owner,
    string name, string symbol, uint8 decimals,
    uint256 initialSupply, uint256 maxSupply, string metadataURI
);
```

## Extract the address (viem)

```typescript
import { decodeEventLog } from 'viem';

const receipt = await publicClient.waitForTransactionReceipt({ hash });
for (const log of receipt.logs) {
  try {
    const event = decodeEventLog({ abi: factoryABI, data: log.data, topics: log.topics });
    if (event.eventName === 'TokenCreated') console.log(event.args.tokenAddress);
  } catch {}
}
```

{% hint style="info" %}
Via MCP, `get_transaction_status` parses this event for you and returns the token address directly.
{% endhint %}

Historical events and token data are queryable through the [Subgraph](../infrastructure/subgraph.md).
