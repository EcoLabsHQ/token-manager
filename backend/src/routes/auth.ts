import { Router, Request, Response, NextFunction } from 'express';
import {
  verifySIWXAndCreateSession,
  verifySession,
  generateNonce,
  isFactoryOwner,
  SessionPayload,
} from '../services/auth.js';

const router = Router();

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

/**
 * Middleware to require owner authentication
 * Checks for Bearer token in Authorization header
 */
export function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
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

  // Attach session to request for use in route handlers
  req.session = session;
  next();
}

/**
 * GET /api/auth/nonce
 * Get a fresh nonce for SIWX message
 */
router.get('/nonce', (_req: Request, res: Response) => {
  const nonce = generateNonce();
  return res.json({
    success: true,
    data: { nonce },
  });
});

/**
 * POST /api/auth/verify
 * Verify SIWX signature and create session
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing message or signature',
      });
    }

    // Get expected domain from request origin or use configured value
    const origin = req.headers.origin || req.headers.referer;
    let expectedDomain: string;
    
    if (origin) {
      try {
        const url = new URL(origin);
        expectedDomain = url.host;
      } catch {
        expectedDomain = 'localhost';
      }
    } else {
      expectedDomain = process.env.ADMIN_DOMAIN || 'localhost';
    }

    const result = await verifySIWXAndCreateSession(message, signature, expectedDomain);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      data: {
        token: result.token,
      },
    });
  } catch (error) {
    console.error('Error verifying SIWX:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/session
 * Get current session info
 */
router.get('/session', requireOwnerAuth, (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      address: req.session?.address,
      chainId: req.session?.chainId,
      isOwner: req.session?.isOwner,
    },
  });
});

/**
 * POST /api/auth/check-owner
 * Check if an address is a factory owner (no auth required)
 */
router.post('/check-owner', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Missing address',
      });
    }

    const result = await isFactoryOwner(address);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking owner:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
