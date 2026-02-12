import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { z } from 'zod';
import { uploadTokenLogo, deleteTokenLogo, getPublicLogoUrl, copyImageToTokenAddress, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from '../services/storage';
import { saveTokenLogo, getTokenLogo, deleteTokenLogoRecord } from '../db';

const router = Router();

// Extend Express Request to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configurar multer para almacenar en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`));
    }
  },
});

// Schema de validación
const uploadParamsSchema = z.object({
  chainId: z.string().regex(/^\d+$/).transform(Number),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

/**
 * POST /api/tokens/:chainId/:address/logo
 * Sube un logo para un token
 */
router.post(
  '/:chainId/:address/logo',
  upload.single('logo'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      // Validar parámetros
      const paramsResult = uploadParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: paramsResult.error.issues,
        });
        return;
      }

      const { chainId, address } = paramsResult.data;

      // Verificar que se subió un archivo
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Verificar si ya existe un logo para este token
      const existingLogo = await getTokenLogo(address, chainId);
      if (existingLogo) {
        // Eliminar el logo anterior de R2
        try {
          await deleteTokenLogo(existingLogo.file_key);
        } catch (e) {
          console.warn('Failed to delete old logo from R2:', e);
        }
        // Eliminar el registro de la DB
        await deleteTokenLogoRecord(address, chainId);
      }

      // Subir el nuevo logo a R2
      const result = await uploadTokenLogo(
        chainId,
        address,
        req.file.buffer,
        req.file.mimetype
      );

      // Guardar el registro en la DB
      await saveTokenLogo({
        tokenAddress: address,
        chainId,
        fileKey: result.fileKey,
        contentType: result.contentType,
        fileSize: result.fileSize,
      });

      res.json({
        success: true,
        data: {
          url: result.publicUrl,
          contentType: result.contentType,
          fileSize: result.fileSize,
        },
      });
    } catch (error: unknown) {
      console.error('Error uploading token logo:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024}KB` });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to upload logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Schema for pre-upload with hash identifier (not an address)
const preUploadParamsSchema = z.object({
  chainId: z.string().regex(/^\d+$/).transform(Number),
  identifier: z.string().regex(/^[a-fA-F0-9]{16}$/), // 16 hex chars (first 16 chars of keccak256 hash)
});

/**
 * POST /api/tokens/:chainId/pre-upload/:identifier/logo
 * Sube un logo antes de crear el token, usando un hash identifier
 * Este endpoint NO guarda en la DB, solo sube a R2 con el identifier como clave
 */
router.post(
  '/:chainId/pre-upload/:identifier/logo',
  upload.single('logo'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      const paramsResult = preUploadParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: paramsResult.error.issues,
        });
        return;
      }

      const { chainId, identifier } = paramsResult.data;

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload to R2 with the identifier (not a token address)
      const result = await uploadTokenLogo(
        chainId,
        identifier, // Use hash identifier instead of address
        req.file.buffer,
        req.file.mimetype
      );

      res.json({
        success: true,
        data: {
          url: result.publicUrl,
          contentType: result.contentType,
          fileSize: result.fileSize,
          identifier,
        },
      });
    } catch (error: unknown) {
      console.error('Error uploading pre-token logo:', error);

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024}KB` });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to upload logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/tokens/:chainId/:address/logo
 * Obtiene la URL del logo de un token
 */
router.get('/:chainId/:address/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;

    const logo = await getTokenLogo(address, chainId);
    if (!logo) {
      res.status(404).json({ error: 'Logo not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        url: getPublicLogoUrl(logo.file_key),
        contentType: logo.content_type,
        fileSize: logo.file_size,
        createdAt: logo.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting token logo:', error);
    res.status(500).json({
      error: 'Failed to get logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/tokens/:chainId/:address/logo
 * Elimina el logo de un token
 */
router.delete('/:chainId/:address/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;

    const logo = await getTokenLogo(address, chainId);
    if (!logo) {
      res.status(404).json({ error: 'Logo not found' });
      return;
    }

    // Eliminar de R2
    await deleteTokenLogo(logo.file_key);

    // Eliminar de la DB
    await deleteTokenLogoRecord(address, chainId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting token logo:', error);
    res.status(500).json({
      error: 'Failed to delete logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tokens/logos/batch
 * Obtiene las URLs de logos para múltiples tokens
 * Query: tokens = [{chainId: number, address: string}, ...]
 */
router.post('/logos/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const tokensSchema = z.array(
      z.object({
        chainId: z.number(),
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      })
    ).max(50); // Limitar a 50 tokens por request

    const result = tokensSchema.safeParse(req.body.tokens);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: result.error.issues,
      });
      return;
    }

    const tokens = result.data;
    const logos: Record<string, string> = {};

    // Obtener todos los logos
    for (const token of tokens) {
      const logo = await getTokenLogo(token.address, token.chainId);
      if (logo) {
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        logos[key] = getPublicLogoUrl(logo.file_key);
      }
    }

    res.json({
      success: true,
      data: logos,
    });
  } catch (error) {
    console.error('Error getting batch logos:', error);
    res.status(500).json({
      error: 'Failed to get logos',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/:chainId/:address/logo/copy
 * Copia una imagen de un hash temporal a la dirección real del token
 * Body: { sourceHash: string } - el hash usado para subir la imagen originalmente
 */
router.post('/:chainId/:address/logo/copy', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;
    const { sourceHash } = req.body;

    if (!sourceHash || typeof sourceHash !== 'string') {
      res.status(400).json({ error: 'sourceHash is required' });
      return;
    }

    // Copy the image from hash to token address
    const result = await copyImageToTokenAddress(chainId, sourceHash, address);

    if (!result) {
      res.status(404).json({ error: 'Source image not found' });
      return;
    }

    // Save the new logo record in DB
    await saveTokenLogo({
      tokenAddress: address,
      chainId,
      fileKey: result.fileKey,
      contentType: result.contentType,
      fileSize: result.fileSize,
    });

    res.json({
      success: true,
      data: {
        url: result.publicUrl,
        contentType: result.contentType,
        fileSize: result.fileSize,
      },
    });
  } catch (error) {
    console.error('Error copying logo:', error);
    res.status(500).json({
      error: 'Failed to copy logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
