# Token Manager Skill

You are an AI agent capable of deploying and managing ERC-20 tokens on Celo and Ethereum using the Token Manager MCP server.

## Required Setup

Before creating tokens, confirm the following are in place:

1. **Backend running** at `http://localhost:3001` — the MCP server must be reachable.
2. **`AGENT_WALLET_PRIVATE_KEY`** set in `backend/.env` — a dedicated wallet with test funds.
3. **Funded wallet** — use `get_wallet_info` to verify balances before transacting.

> ⚠️ Always use a dedicated test wallet with minimal funds. Never use a wallet that holds significant value.

---

## Standard Workflow: Create a Celo Native Token

Follow these steps in order:

### Step 1 — Check the wallet
```
get_wallet_info()
```
Verify the address and that it has enough CELO for gas + creation fee.

### Step 2 — Get the creation fee
```
get_creation_fee(chainId: 42220)
```
Note the `creationFeeWei` value — you'll use it in Step 5.

### Step 3 — Pin metadata to IPFS
```
pin_token_metadata(
  name: "...",
  symbol: "...",
  decimals: 18,
  description: "..."
)
```
Note the `metadataURI` (e.g., `ipfs://Qm...`).

### Step 4 — Build the transaction calldata
```
build_create_token_transaction(
  chainId: 42220,
  owner: "<wallet address from Step 1>",
  name: "...",
  symbol: "...",
  decimals: 18,
  initialSupply: "1000000",
  maxSupply: "0",
  metadataURI: "<metadataURI from Step 3>"
)
```
Note the `to` and `data` fields.

### Step 5 — Send the transaction
```
send_transaction(
  chainId: 42220,
  to: "<factoryAddress from Step 4>",
  data: "<data from Step 4>",
  value: "<creationFeeWei from Step 2>"
)
```
Returns `transactionHash`, `status`, and `explorerUrl`.

---

## Ethereum-Enabled Token (L1 + L2)

For tokens that bridge between Ethereum and Celo, repeat Steps 2–5 for each chain in order:

1. Create token on **Ethereum (chainId: 1)**
2. Create token on **Celo (chainId: 42220)**, passing the L1 token address

Use `get_supported_chains` to see factory addresses for both chains.

---

## Using Promo Codes

If the user has a promo code, insert this step before building the transaction:

```
validate_promo_code(
  code: "LAUNCH2024",
  userAddress: "<wallet address>",
  chainId: 42220
)
```

Pass `promoFee`, `promoNonce`, `expiresAt`, and `signature` to `build_create_token_transaction`.

---

## Safety Rules

- **Always confirm** token parameters with the user before calling `send_transaction`.
- **Never log or expose** the private key — the MCP server handles it internally.
- **Use testnets first**: Celo Alfajores (44787) or Ethereum Sepolia (11155111) for testing.
- If `send_transaction` returns `status: "reverted"`, check the wallet balance and fee amount before retrying.
- Do not retry a failed `send_transaction` automatically — ask the user first.

---

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `get_wallet_info` | Wallet address + native balances |
| `get_creation_fee` | Current factory fee on-chain |
| `get_supported_chains` | Chain IDs, factory addresses, RPC URLs |
| `pin_token_metadata` | Upload metadata to IPFS |
| `build_create_token_transaction` | Generate transaction calldata |
| `send_transaction` | Sign and broadcast the transaction |
| `validate_promo_code` | Get discount signature |
| `list_tokens` | Browse deployed tokens |
| `get_token_details` | Token info, holders, transfers |
| `get_tokens_by_owner` | Tokens for a given address |

---

## Chain Reference

| Network | Chain ID | Type |
|---------|----------|------|
| Celo | `42220` | L2 (primary) |
| Ethereum | `1` | L1 |
| Celo Alfajores | `44787` | L2 Testnet |
| Ethereum Sepolia | `11155111` | L1 Testnet |
