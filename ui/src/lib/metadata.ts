import { BACKEND_API_URL } from '@/config/contracts';

/**
 * Token metadata following ERC-7572 standard
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  decimals: number;
  image?: string;
  external_link?: string;
  properties?: {
    maxSupply?: string;
    initialSupply?: string;
    creator?: string;
    chainId?: number;
    [key: string]: unknown;
  };
}

export interface PinMetadataResponse {
  success: boolean;
  data?: {
    cid: string;
    metadataURI: string;
    gatewayUrl: string;
  };
  error?: string;
}

export interface PinImageResponse {
  success: boolean;
  data?: {
    cid: string;
    ipfsURI: string;
    gatewayUrl: string;
  };
  error?: string;
}

export interface PinWithImageResponse {
  success: boolean;
  data?: {
    cid: string;
    metadataURI: string;
    gatewayUrl: string;
  };
  error?: string;
}

/**
 * Convert a File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/xxx;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Pin token metadata with optional image to IPFS via backend
 */
export async function pinTokenMetadata(
  metadata: Omit<TokenMetadata, 'image'>,
  imageFile?: File
): Promise<PinWithImageResponse> {
  try {
    let imageBase64: string | undefined;
    let imageFilename: string | undefined;
    let imageContentType: string | undefined;

    if (imageFile) {
      imageBase64 = await fileToBase64(imageFile);
      imageFilename = imageFile.name;
      imageContentType = imageFile.type;
    }

    const response = await fetch(`${BACKEND_API_URL}/api/metadata/pin-with-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...metadata,
        imageBase64,
        imageFilename,
        imageContentType,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP error ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    console.error('Error pinning metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Pin just metadata JSON to IPFS (without image)
 */
export async function pinMetadataOnly(
  metadata: TokenMetadata
): Promise<PinMetadataResponse> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/metadata/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP error ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    console.error('Error pinning metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
