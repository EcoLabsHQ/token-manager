import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  pinMetadata,
  pinImage,
  pinTokenAssets,
  getFromIPFS,
  testConnection,
  type TokenMetadata,
} from '../services/pinata';

const router = Router();

// Validation schemas
const metadataSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  description: z.string().max(1000).optional(),
  decimals: z.number().int().min(0).max(18),
  image: z.string().url().optional(), // Pre-existing image URL
  external_link: z.string().url().optional(),
  properties: z
    .object({
      maxSupply: z.string().optional(),
      initialSupply: z.string().optional(),
      creator: z.string().optional(),
      chainId: z.number().optional(),
    })
    .passthrough()
    .optional(),
});

const pinWithImageSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  description: z.string().max(1000).optional(),
  decimals: z.number().int().min(0).max(18),
  external_link: z.string().url().optional(),
  properties: z
    .object({
      maxSupply: z.string().optional(),
      initialSupply: z.string().optional(),
      creator: z.string().optional(),
      chainId: z.number().optional(),
    })
    .passthrough()
    .optional(),
  // Base64 encoded image
  imageBase64: z.string().optional(),
  imageFilename: z.string().optional(),
  imageContentType: z
    .enum(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'])
    .optional(),
});

const pinImageSchema = z.object({
  imageBase64: z.string(),
  filename: z.string(),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']),
});

/**
 * POST /api/metadata/pin
 * Pin token metadata JSON to IPFS
 * 
 * Body: TokenMetadata object
 * Returns: { cid, metadataURI, gatewayUrl }
 */
router.post('/pin', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = metadataSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid metadata',
        details: parseResult.error.issues,
      });
      return;
    }

    const data = parseResult.data;
    
    const tokenMetadata: TokenMetadata = {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      decimals: data.decimals,
      image: data.image,
      external_link: data.external_link,
      properties: data.properties,
    };

    const result = await pinMetadata(tokenMetadata, data.name);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error pinning metadata:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin metadata',
    });
  }
});

/**
 * POST /api/metadata/pin-with-image
 * Pin both image and metadata to IPFS in one request
 * 
 * Body: metadata + base64 encoded image
 * Returns: { cid, metadataURI, gatewayUrl }
 */
router.post('/pin-with-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = pinWithImageSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const data = parseResult.data;

    let imageBuffer: Buffer | undefined;
    
    if (data.imageBase64 && data.imageFilename && data.imageContentType) {
      // Remove data URL prefix if present
      const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    const metadata: Omit<TokenMetadata, 'image'> = {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      decimals: data.decimals,
      external_link: data.external_link,
      properties: data.properties,
    };

    const result = await pinTokenAssets(
      metadata,
      imageBuffer,
      data.imageFilename,
      data.imageContentType
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error pinning assets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin assets',
    });
  }
});

/**
 * POST /api/metadata/pin-image
 * Pin just an image to IPFS
 * 
 * Body: { imageBase64, filename, contentType }
 * Returns: { cid, ipfsURI, gatewayUrl }
 */
router.post('/pin-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = pinImageSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const data = parseResult.data;

    // Remove data URL prefix if present
    const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const result = await pinImage(imageBuffer, data.filename, data.contentType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error pinning image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin image',
    });
  }
});

/**
 * GET /api/metadata/health
 * Check Pinata connection health
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const connected = await testConnection();
  
  res.json({
    success: true,
    data: {
      pinata: connected ? 'connected' : 'disconnected',
    },
  });
});

/**
 * GET /api/metadata/:cid
 * Fetch metadata from IPFS via gateway
 */
router.get('/:cid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cid } = req.params;
    const data = await getFromIPFS(cid);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching from IPFS:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch from IPFS',
    });
  }
});

export default router;
