import { createPublicClient, http, hashMessage, recoverMessageAddress, isAddress } from 'viem';
import { mainnet, celo } from 'viem/chains';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

// Factory contract addresses by chainId
const FACTORY_CONTRACTS: Record<number, { address: `0x${string}`; chain: typeof mainnet | typeof celo }> = {
  1: {
    address: '0x8896769dA38E99Ace4C1Adc316181FEeae175074',
    chain: mainnet,
  },
  42220: {
    address: '0x8896769dA38E99Ace4C1Adc316181FEeae175074',
    chain: celo,
  },
};

// EIP-1271 magic value for valid signatures
const EIP1271_MAGIC_VALUE = '0x1626ba7e';

// EIP-1271 ABI for isValidSignature
const EIP1271_ABI = [
  {
    name: 'isValidSignature',
    type: 'function',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes4' }],
    stateMutability: 'view',
  },
] as const;

// ABI for owner() function
const OWNABLE_ABI = [
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export interface SIWXMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  resources?: string[];
}

export interface SessionPayload {
  address: string;
  chainId: number;
  isOwner: boolean;
  iat: number;
  exp: number;
}

// Store for used nonces (in production, use Redis or database)
const usedNonces = new Set<string>();

/**
 * Get the owner of the factory contract on a specific chain
 */
export async function getFactoryOwner(chainId: number): Promise<string | null> {
  const contract = FACTORY_CONTRACTS[chainId];
  if (!contract) {
    console.error(`Unsupported chainId: ${chainId}`);
    return null;
  }

  try {
    const client = createPublicClient({
      chain: contract.chain,
      transport: http(),
    });

    const owner = await client.readContract({
      address: contract.address,
      abi: OWNABLE_ABI,
      functionName: 'owner',
    });

    return owner.toLowerCase();
  } catch (error) {
    console.error('Error fetching factory owner:', error);
    return null;
  }
}

/**
 * Check if an address is a contract (for EIP-1271 signature verification)
 */
async function isContract(address: `0x${string}`, chainId: number = 1): Promise<boolean> {
  const chain = chainId === 42220 ? celo : mainnet;
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const code = await client.getCode({ address });
    return code !== undefined && code !== '0x';
  } catch {
    return false;
  }
}

/**
 * Verify EIP-1271 signature (for smart contract wallets like Safe)
 */
async function verifyEIP1271Signature(
  address: `0x${string}`,
  message: string,
  signature: `0x${string}`,
  chainId: number = 1
): Promise<boolean> {
  const chain = chainId === 42220 ? celo : mainnet;
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const messageHash = hashMessage(message);
    
    const result = await client.readContract({
      address,
      abi: EIP1271_ABI,
      functionName: 'isValidSignature',
      args: [messageHash, signature],
    });

    return result === EIP1271_MAGIC_VALUE;
  } catch (error) {
    console.error('EIP-1271 verification error:', error);
    return false;
  }
}

/**
 * Verify a message signature (supports both EOA and EIP-1271 smart contract wallets)
 */
async function verifySignature(
  address: `0x${string}`,
  message: string,
  signature: `0x${string}`,
  chainId: number = 1
): Promise<boolean> {
  // First try EOA verification
  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature,
    });

    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      return true;
    }
  } catch {
    // If EOA verification fails, try EIP-1271
  }

  // Check if it's a contract and try EIP-1271
  const contractCheck = await isContract(address, chainId);
  if (contractCheck) {
    return verifyEIP1271Signature(address, message, signature, chainId);
  }

  return false;
}

/**
 * Check if an address is the owner of any factory
 */
export async function isFactoryOwner(address: string): Promise<{ isOwner: boolean; chainIds: number[] }> {
  const ownerChains: number[] = [];
  const lowerAddress = address.toLowerCase();

  for (const chainId of Object.keys(FACTORY_CONTRACTS).map(Number)) {
    const owner = await getFactoryOwner(chainId);
    if (owner && owner === lowerAddress) {
      ownerChains.push(chainId);
    }
  }

  return {
    isOwner: ownerChains.length > 0,
    chainIds: ownerChains,
  };
}

/**
 * Parse a SIWX message string into its components
 */
export function parseSIWXMessage(message: string): SIWXMessage | null {
  try {
    // SIWX message format (CAIP-122):
    // {domain} wants you to sign in with your Ethereum account:
    // {address}
    //
    // {statement}
    //
    // URI: {uri}
    // Version: {version}
    // Chain ID: {chainId}
    // Nonce: {nonce}
    // Issued At: {issuedAt}
    // [Expiration Time: {expirationTime}]
    // [Resources:]
    // [- {resource1}]
    // [- {resource2}]

    const lines = message.split('\n');
    
    // Parse domain from first line
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your/);
    if (!domainMatch) return null;
    const domain = domainMatch[1];

    // Address is on the second line
    const address = lines[1]?.trim();
    if (!address || !address.startsWith('0x')) return null;

    // Find statement (optional, between address and URI)
    let statement: string | undefined;
    let uriLineIndex = lines.findIndex(l => l.startsWith('URI:'));
    if (uriLineIndex > 3) {
      // There's a statement between address (line 1) and URI
      statement = lines.slice(3, uriLineIndex).filter(l => l.trim()).join('\n');
    }

    // Parse required fields
    const getField = (prefix: string): string | undefined => {
      const line = lines.find(l => l.startsWith(prefix));
      return line?.slice(prefix.length).trim();
    };

    const uri = getField('URI: ');
    const version = getField('Version: ');
    const chainId = getField('Chain ID: ');
    const nonce = getField('Nonce: ');
    const issuedAt = getField('Issued At: ');
    const expirationTime = getField('Expiration Time: ');

    if (!uri || !version || !chainId || !nonce || !issuedAt) {
      return null;
    }

    // Parse resources
    const resourcesIndex = lines.findIndex(l => l.startsWith('Resources:'));
    const resources: string[] = [];
    if (resourcesIndex !== -1) {
      for (let i = resourcesIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('- ')) {
          resources.push(line.slice(2));
        } else if (line.trim() === '') {
          continue;
        } else {
          break;
        }
      }
    }

    return {
      domain,
      address,
      statement,
      uri,
      version,
      chainId,
      nonce,
      issuedAt,
      expirationTime,
      resources: resources.length > 0 ? resources : undefined,
    };
  } catch (error) {
    console.error('Error parsing SIWX message:', error);
    return null;
  }
}

/**
 * Verify a SIWX signature and create a session
 */
export async function verifySIWXAndCreateSession(
  message: string,
  signature: `0x${string}`,
  expectedDomain: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  // Parse the message
  const parsed = parseSIWXMessage(message);
  if (!parsed) {
    return { success: false, error: 'Invalid SIWX message format' };
  }

  // Validate domain
  if (parsed.domain !== expectedDomain) {
    return { success: false, error: 'Domain mismatch' };
  }

  // Check nonce hasn't been used
  if (usedNonces.has(parsed.nonce)) {
    return { success: false, error: 'Nonce already used' };
  }

  // Check expiration
  if (parsed.expirationTime) {
    const expTime = new Date(parsed.expirationTime).getTime();
    if (Date.now() > expTime) {
      return { success: false, error: 'Message expired' };
    }
  }

  // Verify signature (supports both EOA and EIP-1271 smart contract wallets like Safe)
  const chainId = parseInt(parsed.chainId) || 1;
  try {
    const isValid = await verifySignature(
      parsed.address as `0x${string}`,
      message,
      signature,
      chainId
    );

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }
  } catch (error) {
    console.error('Signature verification error:', error);
    return { success: false, error: 'Signature verification failed' };
  }

  // Mark nonce as used
  usedNonces.add(parsed.nonce);

  // Check if the address is a factory owner
  const { isOwner, chainIds } = await isFactoryOwner(parsed.address);

  if (!isOwner) {
    return { success: false, error: 'Address is not a factory owner' };
  }

  // Create JWT session token
  const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
    address: parsed.address.toLowerCase(),
    chainId: chainIds[0], // Primary chain
    isOwner: true,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_DURATION,
  });

  return { success: true, token };
}

/**
 * Verify a session token
 */
export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a random nonce for SIWX
 */
export function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 16; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
