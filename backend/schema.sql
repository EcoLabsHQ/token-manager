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

-- Datos de ejemplo
INSERT INTO promo_codes (code, discount_fee, expires_at, max_uses) VALUES
    ('FREEMINT2026', '0', EXTRACT(EPOCH FROM NOW() + INTERVAL '30 days')::BIGINT, 100),
    ('HALFPRICE', '5000000000000000', EXTRACT(EPOCH FROM NOW() + INTERVAL '7 days')::BIGINT, 50),
    ('EARLYADOPTER', '1000000000000000', EXTRACT(EPOCH FROM NOW() + INTERVAL '30 days')::BIGINT, 200);
