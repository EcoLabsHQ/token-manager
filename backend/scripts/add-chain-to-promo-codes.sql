-- Migration: Add chain_id column to promo_codes table
-- Run this migration on existing databases

-- Add the chain_id column with default value for Ethereum Sepolia
ALTER TABLE promo_codes 
ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 11155111;

-- Update existing promo codes to have the ETH suffix if they don't already
-- This assumes existing codes were for ethereum
UPDATE promo_codes 
SET code = code || '_ETH' 
WHERE code NOT LIKE '%_ETH' 
  AND code NOT LIKE '%_CELO';

-- Create an index on chain_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_promo_codes_chain_id ON promo_codes(chain_id);
