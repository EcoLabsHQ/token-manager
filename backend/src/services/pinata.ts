import { PinataSDK } from 'pinata';

// Pinata Configuration
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';

// Validate configuration
if (!PINATA_JWT) {
  console.warn('⚠️ PINATA_JWT not configured. Metadata pinning will fail.');
}

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT || '',
  pinataGateway: PINATA_GATEWAY,
});

/**
 * Token metadata following ERC-7572 standard
 * https://eips.ethereum.org/EIPS/eip-7572
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  decimals: number;
  image?: string; // IPFS URI or HTTP URL for the logo
  external_link?: string;
  properties?: {
    maxSupply?: string;
    initialSupply?: string;
    creator?: string;
    chainId?: number;
    [key: string]: unknown;
  };
}

export interface PinResult {
  cid: string;
  metadataURI: string;
  gatewayUrl: string;
}

export interface PinImageResult {
  cid: string;
  ipfsURI: string;
  gatewayUrl: string;
}

/**
 * Pin an image to IPFS via Pinata
 * @param imageBuffer - The image buffer to upload
 * @param filename - Original filename (for extension detection)
 * @param contentType - MIME type of the image
 */
export async function pinImage(
  imageBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<PinImageResult> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  // Create a File object from the buffer
  const file = new File([imageBuffer], filename, { type: contentType });

  const upload = await pinata.upload.public.file(file);

  return {
    cid: upload.cid,
    ipfsURI: `ipfs://${upload.cid}`,
    gatewayUrl: `https://${PINATA_GATEWAY}/ipfs/${upload.cid}`,
  };
}

/**
 * Pin token metadata JSON to IPFS via Pinata
 * @param metadata - Token metadata object
 * @param tokenName - Used for naming the pin
 */
export async function pinMetadata(
  metadata: TokenMetadata,
  tokenName?: string
): Promise<PinResult> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  // Create JSON file
  const jsonContent = JSON.stringify(metadata, null, 2);
  const filename = `${tokenName || metadata.symbol || 'token'}-metadata.json`;
  const file = new File([jsonContent], filename, { type: 'application/json' });

  const upload = await pinata.upload.public.file(file);

  return {
    cid: upload.cid,
    metadataURI: `ipfs://${upload.cid}`,
    gatewayUrl: `https://${PINATA_GATEWAY}/ipfs/${upload.cid}`,
  };
}

/**
 * Pin both image and metadata in one operation
 * Returns the metadata URI with the image already embedded
 */
export async function pinTokenAssets(
  metadata: Omit<TokenMetadata, 'image'>,
  imageBuffer?: Buffer,
  imageFilename?: string,
  imageContentType?: string
): Promise<PinResult> {
  let imageURI: string | undefined;

  // First, pin the image if provided
  if (imageBuffer && imageFilename && imageContentType) {
    const imageResult = await pinImage(imageBuffer, imageFilename, imageContentType);
    imageURI = imageResult.ipfsURI;
  }

  // Then pin the metadata with the image URI
  const fullMetadata: TokenMetadata = {
    ...metadata,
    image: imageURI,
  };

  return pinMetadata(fullMetadata, metadata.name);
}

/**
 * Get content from IPFS via Pinata gateway
 * @param cid - The IPFS CID to fetch
 */
export async function getFromIPFS(cid: string): Promise<unknown> {
  const response = await pinata.gateways.public.get(cid);
  return response;
}

/**
 * Convert CID to gateway URL
 * @param cid - The IPFS CID
 */
export function getGatewayUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}

/**
 * Test Pinata connection
 */
export async function testConnection(): Promise<boolean> {
  if (!PINATA_JWT) {
    return false;
  }
  
  try {
    // Try to list files to test authentication
    await pinata.files.public.list().limit(1);
    return true;
  } catch {
    return false;
  }
}
