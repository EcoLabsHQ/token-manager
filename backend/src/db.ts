import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==================== Promo Codes ====================

export interface PromoCode {
  id: number;
  code: string;
  discount_fee: string;
  chain_id: number;
  expires_at: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
}

export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const { rows } = await pool.query<PromoCode>(
    'SELECT * FROM promo_codes WHERE code = $1',
    [code]
  );
  return rows[0] || null;
}

export async function incrementPromoUsage(code: string): Promise<void> {
  await pool.query(
    'UPDATE promo_codes SET current_uses = current_uses + 1 WHERE code = $1',
    [code]
  );
}

// ==================== Token Logos ====================

export interface TokenLogo {
  id: number;
  token_address: string;
  chain_id: number;
  file_key: string;
  content_type: string;
  file_size: number;
  created_at: Date;
  updated_at: Date;
}

export interface SaveTokenLogoParams {
  tokenAddress: string;
  chainId: number;
  fileKey: string;
  contentType: string;
  fileSize: number;
}

export async function saveTokenLogo(params: SaveTokenLogoParams): Promise<TokenLogo> {
  const { tokenAddress, chainId, fileKey, contentType, fileSize } = params;
  
  const { rows } = await pool.query<TokenLogo>(
    `INSERT INTO token_logos (token_address, chain_id, file_key, content_type, file_size)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token_address, chain_id)
     DO UPDATE SET file_key = $3, content_type = $4, file_size = $5, updated_at = NOW()
     RETURNING *`,
    [tokenAddress.toLowerCase(), chainId, fileKey, contentType, fileSize]
  );
  
  return rows[0];
}

export async function getTokenLogo(tokenAddress: string, chainId: number): Promise<TokenLogo | null> {
  const { rows } = await pool.query<TokenLogo>(
    'SELECT * FROM token_logos WHERE token_address = $1 AND chain_id = $2',
    [tokenAddress.toLowerCase(), chainId]
  );
  return rows[0] || null;
}

export async function deleteTokenLogoRecord(tokenAddress: string, chainId: number): Promise<void> {
  await pool.query(
    'DELETE FROM token_logos WHERE token_address = $1 AND chain_id = $2',
    [tokenAddress.toLowerCase(), chainId]
  );
}

export async function getTokenLogosByChain(chainId: number): Promise<TokenLogo[]> {
  const { rows } = await pool.query<TokenLogo>(
    'SELECT * FROM token_logos WHERE chain_id = $1',
    [chainId]
  );
  return rows;
}
