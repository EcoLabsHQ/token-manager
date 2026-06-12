# Flow 3: Migrate L2 Token to L1

Gives an existing Celo Native token an L1 counterpart on Ethereum, enabling bridging both ways.

## Steps

| Step | Action | Chain | Who signs |
| ---- | ------ | ----- | --------- |
| 1 | `L1TokenFactory.createToken()` — same name/symbol/decimals, `initialSupply: 0` | Ethereum | Anyone |
| 2 | `L2SuperChainToken.setBridge(L2_BRIDGE)` | Celo | Token owner |
| 3 | `L2SuperChainToken.setRemoteToken(L1_ADDRESS)` | Celo | Token owner |
| 4 | (Optional) `L2StandardBridge.bridgeERC20To()` — burns on L2, mints on L1 | Celo | Token holder |

## Contract calls

```solidity
function setBridge(address bridge_) external onlyOwner;          // Step 2
function setRemoteToken(address remoteToken_) external onlyOwner; // Step 3
```

{% hint style="warning" %}
**Irreversible**: once configured, bridge settings cannot be changed.
{% endhint %}

Notes: supply stays on L2 (L1 starts at 0); after migration, tokens bridge both L1→L2 and L2→L1.
