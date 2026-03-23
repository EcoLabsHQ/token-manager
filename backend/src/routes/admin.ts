import { Router, Request, Response, NextFunction } from 'express';
import { createPublicClient, http } from 'viem';
import { mainnet, celo } from 'viem/chains';
import { pool, PromoCode } from '../db.js';
import { verifySession, SessionPayload } from '../services/auth.js';

const router = Router();

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

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
const CONTRACTS: Record<number, { address: `0x${string}`; chain: typeof mainnet | typeof celo; suffix: string }> = {
  1: { // Ethereum Mainnet
    address: '0xa7763537F4C1F321C31AaAc2a2e3b5c674f568D2',
    chain: mainnet,
    suffix: 'ETH',
  },
  42220: { // Celo Mainnet
    address: '0x5D36082CeA243a5aA7532aBb6Ff31b25418281a4',
    chain: celo,
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

/**
 * Authentication middleware - requires SIWX Bearer token
 * Only factory owners can access admin routes
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing authorization header',
    });
  }

  const token = authHeader.slice(7);
  const session = verifySession(token);
  
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired session',
    });
  }

  if (!session.isOwner) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Not a factory owner',
    });
  }

  req.session = session;
  next();
}

/**
 * GET /api/admin/verify
 * Verify if the session is valid
 */
router.get('/verify', requireAuth, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Session is valid',
  });
});

/**
 * GET /api/admin/promo-codes
 * List all promo codes with usage stats
 */
router.get('/promo-codes', requireAuth, async (_req: Request, res: Response) => {
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
router.post('/promo-codes', requireAuth, async (req: Request, res: Response) => {
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
router.patch('/promo-codes/:id', requireAuth, async (req: Request, res: Response) => {
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
router.delete('/promo-codes/:id', requireAuth, async (req: Request, res: Response) => {
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
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
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
