-- Tabla de códigos promocionales
CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_fee VARCHAR(78) NOT NULL, -- Wei amount as string (uint256 max = 78 digits)
    expires_at BIGINT NOT NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

