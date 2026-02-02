-- Seed promo codes for different chains
-- CODE:CHAINID format allows chain-specific promo codes

-- Clear existing TEST promo codes (optional - comment out if you want to keep them)
-- DELETE FROM promo_codes WHERE code LIKE 'TEST%';

-- TEST promo code for Sepolia (0.001 ETH = 1000000000000000 wei)
INSERT INTO promo_codes (code, discount_fee, max_uses, expires_at, is_active)
VALUES ('TEST:11155111', '1000000000000000', 1000, NOW() + INTERVAL '1 year', true)
ON CONFLICT (code) DO UPDATE SET
  discount_fee = EXCLUDED.discount_fee,
  max_uses = EXCLUDED.max_uses,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;

-- TEST promo code for Celo Alfajores/Sepolia (0.001 CELO = 1000000000000000 wei)
INSERT INTO promo_codes (code, discount_fee, max_uses, expires_at, is_active)
VALUES ('TEST:11142220', '1000000000000000', 1000, NOW() + INTERVAL '1 year', true)
ON CONFLICT (code) DO UPDATE SET
  discount_fee = EXCLUDED.discount_fee,
  max_uses = EXCLUDED.max_uses,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;

-- LAUNCH promo code for Sepolia (free deployment - 0 fee)
INSERT INTO promo_codes (code, discount_fee, max_uses, expires_at, is_active)
VALUES ('LAUNCH:11155111', '0', 100, NOW() + INTERVAL '3 months', true)
ON CONFLICT (code) DO UPDATE SET
  discount_fee = EXCLUDED.discount_fee,
  max_uses = EXCLUDED.max_uses,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;

-- LAUNCH promo code for Celo (free deployment - 0 fee)
INSERT INTO promo_codes (code, discount_fee, max_uses, expires_at, is_active)
VALUES ('LAUNCH:11142220', '0', 100, NOW() + INTERVAL '3 months', true)
ON CONFLICT (code) DO UPDATE SET
  discount_fee = EXCLUDED.discount_fee,
  max_uses = EXCLUDED.max_uses,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;

-- Verify the inserted codes
SELECT code, discount_fee, max_uses, used_count, expires_at, is_active FROM promo_codes ORDER BY code;
