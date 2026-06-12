# Deployment

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install
export PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=...
```

## Deploy

```bash
# L1TokenFactory (Ethereum)
forge script script/DeployL1TokenFactory.s.sol:DeployL1TokenFactory \
  --rpc-url $ETH_RPC_URL --broadcast --verify

# L2SuperChainTokenFactory (Celo)
forge script script/DeployL2SuperChainTokenFactory.s.sol:DeployL2SuperChainTokenFactory \
  --rpc-url $CELO_RPC_URL --broadcast --verify
```

## Test & format

```bash
forge build && forge test && forge fmt
```

Live addresses: [Deployed Addresses](../resources/deployed-addresses.md).
