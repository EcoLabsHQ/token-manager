import { Router, Request, Response, NextFunction } from 'express';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { celoAlfajores } from 'viem/chains';
import { pool, PromoCode } from '../db';

const router = Router();

// API Key middleware for admin routes
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key-change-in-production';

// ABI for creationFee function
const FACTORY_ABI = [
  {
    name: 'creationFee',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Contract addresses for each chain by chainId
const CONTRACTS: Record<number, { address: `0x${string}`; chain: typeof sepolia | typeof celoAlfajores; suffix: string }> = {
  11155111: { // Ethereum Sepolia
    address: '0xf87eA3325c6F5Be2119D40747752BB255CdF1eE8',
    chain: sepolia,
    suffix: 'ETH',
  },
  11142220: { // Celo Alfajores
    address: '0xda572dDA586970a0b844d2E7a2e55fe3af35b225',
    chain: celoAlfajores,
    suffix: 'CELO',
  },
};

// Fetch creationFee from contract using viem
async function fetchCreationFeeFromContract(chainId: number): Promise<bigint> {
  const contract = CONTRACTS[chainId];
  if (!contract) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }
  
  try {
    const client = createPublicClient({
      chain: contract.chain,
      transport: http(),
    });

    const fee = await client.readContract({
      address: contract.address,
      abi: FACTORY_ABI,
      functionName: 'creationFee',
    });

    return fee;
  } catch (error) {
    console.error('Error fetching creation fee from contract:', error);
    // Return default fee (0.1 ETH/CELO) as fallback
    return BigInt('100000000000000000');
  }
}

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
    const { code, discountType, discountValue, expiresAt, maxUses, chainId } = req.body;

    if (!code || !discountType || !expiresAt || !maxUses || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Validate chainId
    const contract = CONTRACTS[chainId];
    if (!contract) {
      return res.status(400).json({
        success: false,
        error: `Invalid chainId. Supported chains: ${Object.keys(CONTRACTS).join(', ')}`,
      });
    }

    // Add chain suffix to code
    const fullCode = `${code.toUpperCase()}_${contract.suffix}`;

    // Fetch actual creation fee from the contract
    const baseFee = await fetchCreationFeeFromContract(chainId);
    
    let discountFee: string;
    if (discountType === 'free') {
      discountFee = '0';
    } else {
      // percentage discount - calculate the discounted fee based on actual contract fee
      const percentage = Number(discountValue);
      const discount = (baseFee * BigInt(percentage)) / BigInt(100);
      discountFee = (baseFee - discount).toString();
    }

    const { rows } = await pool.query<PromoCode>(
      `INSERT INTO promo_codes (code, discount_fee, chain_id, expires_at, max_uses, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [fullCode, discountFee, chainId, expiresAt, maxUses]
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
