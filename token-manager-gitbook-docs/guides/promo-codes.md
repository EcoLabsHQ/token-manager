# Promo Codes

All flows support promo codes that reduce or eliminate creation fees.

## How it works

1. Backend validates the code (usage limit, expiry, active)
2. Backend returns an ECDSA signature over user, fee, nonce, expiry
3. User calls `createTokenWithPromo()` with the signature
4. Factory verifies the signature on-chain and consumes the nonce (single use)

## Validate a code

```bash
curl -X POST http://localhost:3001/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{ "code": "LAUNCH2024", "userAddress": "0x...",
        "chainId": 42220, "factoryAddress": "0x..." }'
# → signature data for createTokenWithPromo
```

Other endpoints: `GET /api/promo/check/:code` (check without consuming), `GET /api/promo/signer` (signer address).

## Via MCP

`build_create_token_transaction` accepts either a `promoCode` string (auto-validated) or the individual fields from `validate_promo_code`.

## Managing codes

Created and managed in the [Admin Dashboard](../infrastructure/admin-dashboard.md): % discounts or 100% free, usage limits, activation, tracking.

## Errors

| Error | Fix |
| ----- | --- |
| `InvalidSignature` | Refresh promo validation |
| `PromoExpired` | Use a different code |
| `PromoNonceAlreadyUsed` | Request a new validation |
