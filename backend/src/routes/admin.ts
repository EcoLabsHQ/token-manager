import { Router, Request, Response, NextFunction } from 'express';
import { pool, PromoCode } from '../db';

const router = Router();

// API Key middleware for admin routes
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key-change-in-production';

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key',
    });
  }
  
  next();
}

/**
 * GET /api/admin/verify
 * Verify if the API key is valid
 */
router.get('/verify', requireApiKey, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'API key is valid',
  });
});

/**
 * GET /api/admin/promo-codes
 * List all promo codes with usage stats
 */
router.get('/promo-codes', requireApiKey, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<PromoCode>(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    );
    
    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/admin/promo-codes
 * Create a new promo code
 */
router.post('/promo-codes', requireApiKey, async (req: Request, res: Response) => {
  try {
    const { code, discountType, discountValue, expiresAt, maxUses } = req.body;

    if (!code || !discountType || !expiresAt || !maxUses) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Calculate discount_fee based on type
    // If "free" -> discount_fee = "0" (full free)
    // If "percentage" -> we store the percentage as a negative value or special format
    // For simplicity, we'll use "0" for free and calculate wei for percentage discounts
    // Assuming base fee is 0.01 ETH = 10000000000000000 wei
    const BASE_FEE = BigInt('10000000000000000'); // 0.01 ETH in wei
    
    let discountFee: string;
    if (discountType === 'free') {
      discountFee = '0';
    } else {
      // percentage discount - calculate the discounted fee
      const percentage = Number(discountValue);
      const discount = (BASE_FEE * BigInt(percentage)) / BigInt(100);
      discountFee = (BASE_FEE - discount).toString();
    }

    const { rows } = await pool.query<PromoCode>(
      `INSERT INTO promo_codes (code, discount_fee, expires_at, max_uses, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [code.toUpperCase(), discountFee, expiresAt, maxUses]
    );

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: unknown) {
    console.error('Error creating promo code:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Promo code already exists',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PATCH /api/admin/promo-codes/:id
 * Update a promo code (toggle active status)
 */
router.patch('/promo-codes/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { rows } = await pool.query<PromoCode>(
      `UPDATE promo_codes SET is_active = $1 WHERE id = $2 RETURNING *`,
      [is_active, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating promo code:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/admin/promo-codes/:id
 * Delete a promo code
 */
router.delete('/promo-codes/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM promo_codes WHERE id = $1`,
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
    }

    return res.json({
      success: true,
      message: 'Promo code deleted',
    });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', requireApiKey, async (_req: Request, res: Response) => {
  try {
    // Get promo code stats
    const promoStats = await pool.query(`
      SELECT 
        COUNT(*) as total_codes,
        SUM(current_uses) as total_uses,
        COUNT(*) FILTER (WHERE is_active = true AND expires_at > EXTRACT(EPOCH FROM NOW())) as active_codes
      FROM promo_codes
    `);

    return res.json({
      success: true,
      data: {
        promoCodes: {
          total: parseInt(promoStats.rows[0].total_codes) || 0,
          totalUses: parseInt(promoStats.rows[0].total_uses) || 0,
          active: parseInt(promoStats.rows[0].active_codes) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
