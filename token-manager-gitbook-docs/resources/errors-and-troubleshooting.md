# Errors & Troubleshooting

## Token creation errors

| Error | Cause | Fix |
| ----- | ----- | --- |
| `InsufficientFee` | Sent value < creation fee | Send the correct fee |
| `InvalidOwner` / `ZeroAddress` | Zero address used | Provide a valid address |
| `InvalidSupply` / `ExceedsMaxSupply` | initialSupply > maxSupply | Fix supply values |
| `InvalidPromoSignature` | Bad promo signature | Refresh promo validation |
| `PromoCodeExpired` | Code expired | Use a different code |
| `PromoNonceAlreadyUsed` | Promo reused | Request a new validation |
| `OptimismMintableERC20__OnlyBridge` | Non-bridge called mint/burn | Only the bridge may call these |

## Transaction failures

1. **Gas estimation fails** → set gas limit to 600000 (or use MCP `estimate_gas`, which adds a 20% buffer)
2. **Reverted** → verify all parameters
3. **Chain switch fails** → switch network manually in the wallet and retry

## API errors

```json
{ "success": false, "error": "Description", "details": [ ... ] }
```

`400` invalid params/promo · `404` not found · `500` server error
