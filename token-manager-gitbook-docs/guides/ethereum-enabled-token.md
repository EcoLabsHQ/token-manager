# Flow 2: Ethereum Enabled Token

Creates a token on Ethereum L1, then a bridged counterpart on Celo L2, linked via the OP Stack standard bridge. Best for tokens that need Ethereum DeFi plus Celo scalability.

## UI steps

1. Select "Ethereum Enabled" and fill in token info
2. Sign L1 deployment (Ethereum)
3. Sign L2 deployment (Celo) — bridge is configured automatically
4. (Optional) Sign approve + bridge to move initial supply to L2

## What happens behind the scenes

| Step | Action | Chain |
| ---- | ------ | ----- |
| 1 | Logo + metadata (same as Flow 1) | — |
| 2 | `L1TokenFactory.createToken()` → **L1 address** | Ethereum |
| 3 | `L2SuperChainTokenFactory.createTokenWithBridge()` — links to L1 address | Celo |
| 4 | `L1Token.approve(L1_BRIDGE, amount)` | Ethereum |
| 5 | `L1StandardBridge.bridgeERC20To()` — locks on L1, mints on L2 after \~15–20 min | Ethereum |

## API example

```bash
# One call returns the full 4-step plan
curl -X POST http://localhost:3001/api/tokens/full-deployment/calldata \
  -H "Content-Type: application/json" \
  -d '{ "tokenType": "ethereum-enabled", "owner": "0xYou",
        "name": "Bridge Token", "symbol": "BRG", "decimals": 18,
        "initialSupply": "1000000", "maxSupply": "10000000",
        "metadataURI": "ipfs://Qm...", "bridgeInitialSupply": true }'
```

## Key contract calls

```solidity
// Step 3 — on Celo
function createTokenWithBridge(
    address owner_, string memory name_, string memory symbol_,
    uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_,
    address bridge_,        // 0x4200...0010 (L2StandardBridge)
    address remoteToken_,   // L1 token address from step 2
    string memory metadataURI_
) external returns (address);

// Step 5 — on Ethereum
function bridgeERC20To(
    address _localToken, address _remoteToken, address _to,
    uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData
) external; // minGasLimit: 200000 recommended
```

## Bridge addresses

| Contract | Address |
| -------- | ------- |
| L1 Standard Bridge | `0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe` |
| L2 Standard Bridge | `0x4200000000000000000000000000000000000010` |
