import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { z } from 'zod';
import { uploadTokenLogo, deleteTokenLogo, getPublicLogoUrl, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from '../services/storage';
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

export default router;
