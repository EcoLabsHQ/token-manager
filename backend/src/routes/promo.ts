import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { getPromoCode, incrementPromoUsage } from '../db';
import { createPromoSignature, getSignerAddress } from '../services/signer';

const router = Router();

// Validation schema
const validatePromoSchema = z.object({
  code: z.string().min(1).max(50),
  userAddress: z.string().refine((val) => ethers.isAddress(val), {
    message: 'Invalid Ethereum address',
  }),
  chainId: z.number().int().positive(),
  factoryAddress: z.string().refine((val) => ethers.isAddress(val), {
    message: 'Invalid factory address',
  }),
});

/**
 * POST /api/promo/validate
 * Validates a promo code and returns a signature if valid
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parseResult = validatePromoSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { code, userAddress, chainId, factoryAddress } = parseResult.data;

    // Try to find promo code with chainId suffix first, then without
    const codeWithChain = `${code.toUpperCase()}:${chainId}`;
    let promoCode = await getPromoCode(codeWithChain);
    
    // If not found with chainId, try the base code
    if (!promoCode) {
      promoCode = await getPromoCode(code.toUpperCase());
    }

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        error: 'Promo code not found',
      });
    }

    // Check if promo code is active
    if (!promoCode.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Promo code is no longer active',
      });
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (promoCode.expires_at <= now) {
      return res.status(400).json({
        success: false,
        error: 'Promo code has expired',
      });
    }

    // Check usage limit
    if (promoCode.current_uses >= promoCode.max_uses) {
      return res.status(400).json({
        success: false,
        error: 'Promo code has reached maximum uses',
      });
    }

    // Generate unique nonce for this promo usage
    const promoNonce = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'address', 'uint256', 'uint256'],
        [code, userAddress, chainId, Date.now()]
      )
    );

    // Create signature
    const signatureResult = await createPromoSignature({
      userAddress,
      promoFee: promoCode.discount_fee,
      promoNonce,
      expiresAt: promoCode.expires_at,
      chainId,
      factoryAddress,
    });

    // Increment usage counter (use the actual code found in DB)
    await incrementPromoUsage(promoCode.code);

    return res.json({
      success: true,
      data: {
        ...signatureResult,
        code: promoCode.code,
        message: 'Promo code validated successfully',
      },
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/promo/signer
 * Returns the current promo signer address
 */
router.get('/signer', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      signerAddress: getSignerAddress(),
    },
  });
});

/**
 * GET /api/promo/check/:code
 * Checks if a promo code is valid without using it
 * Query params: chainId (optional) - if provided, will check for CODE:CHAINID first
 */
router.get('/check/:code', async (req: Request, res: Response) => {
  const { code } = req.params;
  const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;

  // Try to find promo code with chainId suffix first, then without
  let promoCode = null;
  if (chainId) {
    const codeWithChain = `${code.toUpperCase()}:${chainId}`;
    promoCode = await getPromoCode(codeWithChain);
  }
  
  // If not found with chainId, try the base code
  if (!promoCode) {
    promoCode = await getPromoCode(code.toUpperCase());
  }

  if (!promoCode) {
    return res.status(404).json({
      success: false,
      error: 'Promo code not found',
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const isExpired = promoCode.expires_at <= now;
  const isExhausted = promoCode.current_uses >= promoCode.max_uses;
  const isValid = promoCode.is_active && !isExpired && !isExhausted;

  return res.json({
    success: true,
    data: {
      code: promoCode.code,
      isValid,
      discountFee: promoCode.discount_fee,
      expiresAt: promoCode.expires_at,
      remainingUses: Math.max(0, promoCode.max_uses - promoCode.current_uses),
      reason: !promoCode.is_active
        ? 'inactive'
        : isExpired
          ? 'expired'
          : isExhausted
            ? 'exhausted'
            : null,
    },
  });
});

export default router;
