-- Tabla para almacenar referencias a logos de tokens en R2
CREATE TABLE IF NOT EXISTS token_logos (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    file_key VARCHAR(255) NOT NULL,      -- Key en R2: logos/{chainId}/{address}.{ext}
    content_type VARCHAR(50) NOT NULL,   -- image/png, image/jpeg, image/svg+xml, image/webp
    file_size INTEGER NOT NULL,          -- Tamaño en bytes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_token_logo UNIQUE (token_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_token_logos_address ON token_logos(token_address);
CREATE INDEX IF NOT EXISTS idx_token_logos_chain ON token_logos(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_logos_address_chain ON token_logos(token_address, chain_id);
