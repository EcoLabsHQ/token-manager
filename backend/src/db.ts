import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface PromoCode {
  id: number;
  code: string;
  discount_fee: string;
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
