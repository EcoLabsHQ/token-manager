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
    // Extended social / project metadata
    website?: string;
    email?: string;
    category?: string;
    tags?: string;
    social_twitter?: string;
    social_discord?: string;
    social_telegram?: string;
    [key: string]: unknown;
  };
}

// ─── IPFS helpers ─────────────────────────────────────────────────────────────

/** Convert an ipfs:// URI to a public HTTP gateway URL */
export function ipfsToGatewayUrl(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return `https://cloudflare-ipfs.com/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

/**
 * Fetch and parse token metadata JSON from an IPFS URI or HTTP URL.
 * Tries multiple gateways in sequence. Returns null if all fail.
 */
export async function fetchTokenMetadata(
  metadataURI: string
): Promise<TokenMetadata | null> {
  if (!metadataURI) return null;

  const urls: string[] = [];

  if (metadataURI.startsWith('ipfs://')) {
    const cid = metadataURI.slice(7);
    urls.push(
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://${cid}.ipfs.w3s.link`,
    );
  } else {
    urls.push(metadataURI);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      return data as TokenMetadata;
    } catch {
      // try next gateway
    }
  }

  return null;
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
 * Pin token metadata to IPFS, optionally with a new image file.
 * Alias kept for backwards compat — prefer pinTokenMetadata for new code.
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
