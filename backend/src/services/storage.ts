import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'minter-test';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-3e106f2284d449d682bad32c5eeb3490.r2.dev';

// Validar configuración
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn('⚠️ R2 credentials not configured. Token logo uploads will fail.');
}

// S3 Client configurado para Cloudflare R2
const s3Client = new S3Client({
  region: 'auto', // Requerido por AWS SDK, no usado por R2
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

// Tipos soportados de imagen
const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
];

const MAX_FILE_SIZE = 500 * 1024; // 500KB

export interface UploadResult {
  fileKey: string;
  publicUrl: string;
  contentType: string;
  fileSize: number;
}

/**
 * Genera el key para almacenar un logo en R2
 */
function generateFileKey(chainId: number, tokenAddress: string, contentType: string): string {
  const extension = getExtensionFromContentType(contentType);
  // Normalizar address a lowercase
  const address = tokenAddress.toLowerCase();
  return `logos/${chainId}/${address}.${extension}`;
}

/**
 * Obtiene la extensión de archivo basada en el content-type
 */
function getExtensionFromContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  return mapping[contentType] || 'png';
}

/**
 * Valida el archivo antes de subirlo
 */
export function validateFile(buffer: Buffer, contentType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return {
      valid: false,
      error: `Content type not allowed. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: ${MAX_FILE_SIZE / 1024}KB`,
    };
  }

  return { valid: true };
}

/**
 * Sube un logo de token a R2
 */
export async function uploadTokenLogo(
  chainId: number,
  tokenAddress: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const validation = validateFile(buffer, contentType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileKey = generateFileKey(chainId, tokenAddress, contentType);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      // Cache por 1 año ya que el contenido es inmutable por address
      CacheControl: 'public, max-age=31536000',
    })
  );

  return {
    fileKey,
    publicUrl: `${R2_PUBLIC_URL}/${fileKey}`,
    contentType,
    fileSize: buffer.length,
  };
}

/**
 * Elimina un logo de token de R2
 */
export async function deleteTokenLogo(fileKey: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    })
  );
}

/**
 * Verifica si un logo existe en R2
 */
export async function logoExists(fileKey: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileKey,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Genera la URL pública para un logo
 */
export function getPublicLogoUrl(fileKey: string): string {
  return `${R2_PUBLIC_URL}/${fileKey}`;
}

/**
 * Sube una imagen con un identificador personalizado (para pre-token-creation uploads)
 */
export async function uploadImageWithIdentifier(
  chainId: number,
  identifier: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const validation = validateFile(buffer, contentType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const extension = getExtensionFromContentType(contentType);
  // Sanitize identifier: lowercase, remove special chars
  const sanitizedId = identifier.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const fileKey = `logos/${chainId}/${sanitizedId}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );

  return {
    fileKey,
    publicUrl: `${R2_PUBLIC_URL}/${fileKey}`,
    contentType,
    fileSize: buffer.length,
  };
}

/**
 * Copia una imagen de un hash temporal a la dirección real del token
 * Busca en todas las extensiones soportadas
 */
export async function copyImageToTokenAddress(
  chainId: number,
  sourceHash: string,
  targetTokenAddress: string
): Promise<UploadResult | null> {
  const sanitizedHash = sourceHash.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const extensions = ['png', 'jpg', 'svg', 'webp'];
  
  for (const ext of extensions) {
    const sourceKey = `logos/${chainId}/${sanitizedHash}.${ext}`;
    const targetKey = `logos/${chainId}/${targetTokenAddress.toLowerCase()}.${ext}`;
    
    try {
      // Check if source exists
      const headResponse = await s3Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: sourceKey,
        })
      );
      
      // Copy to new location
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET_NAME,
          CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
          Key: targetKey,
          ContentType: headResponse.ContentType,
          CacheControl: 'public, max-age=31536000',
        })
      );
      
      console.log(`✅ Copied image from ${sourceKey} to ${targetKey}`);
      
      return {
        fileKey: targetKey,
        publicUrl: `${R2_PUBLIC_URL}/${targetKey}`,
        contentType: headResponse.ContentType || `image/${ext}`,
        fileSize: headResponse.ContentLength || 0,
      };
    } catch (error) {
      // Source doesn't exist with this extension, try next
      continue;
    }
  }
  
  console.warn(`⚠️ No image found for hash ${sanitizedHash} in chain ${chainId}`);
  return null;
}

export { R2_PUBLIC_URL, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE };
