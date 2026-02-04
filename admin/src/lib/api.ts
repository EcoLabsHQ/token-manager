// Use empty string to leverage Vite's proxy in development
const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

// Debug: log if API key is missing (only in development)
if (import.meta.env.DEV && !ADMIN_API_KEY) {
  console.warn('⚠️ VITE_ADMIN_API_KEY is not set. Make sure .env file exists with the correct key.');
}

// Contract configuration
export const CONTRACTS = {
  L1_TOKEN_FACTORY: {
    address: '0xf87eA3325c6F5Be2119D40747752BB255CdF1eE8' as `0x${string}`,
    chainId: 11155111, // Sepolia
  },
  L2_SUPERCHAIN_TOKEN_FACTORY: {
    address: '0xda572dDA586970a0b844d2E7a2e55fe3af35b225' as `0x${string}`,
    chainId: 11142220, // Celo Sepolia
  },
} as const;

// RPC URLs for fetching contract data
const RPC_URLS = {
  ethereum: 'https://ethereum-sepolia-rpc.publicnode.com',
  celo: 'https://alfajores-forno.celo-testnet.org',
} as const;

// Subgraph URLs (same as main UI)
const SUBGRAPH_URLS = {
  ethereum: 'https://api.studio.thegraph.com/query/72352/minter-ethereum/version/latest',
  celo: 'https://api.studio.thegraph.com/query/72352/minter-celo/version/latest',
} as const;

// Fetch creationFee from contract using eth_call
export async function fetchCreationFee(chain: 'ethereum' | 'celo' = 'ethereum'): Promise<string> {
  const rpcUrl = RPC_URLS[chain];
  const contractAddress = chain === 'ethereum' 
    ? CONTRACTS.L1_TOKEN_FACTORY.address 
    : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address;
  
  // Function selector for creationFee() = keccak256("creationFee()")[:4] = 0x8b47ec43
  const creationFeeSelector = '0x8b47ec43';
  
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: contractAddress,
            data: creationFeeSelector,
          },
          'latest',
        ],
      }),
    });
    
    const data = await response.json();
    if (data.result) {
      // Convert hex to decimal string
      return BigInt(data.result).toString();
    }
    throw new Error(data.error?.message || 'Failed to fetch creation fee');
  } catch (error) {
    console.error('Error fetching creation fee:', error);
    // Return default fee (0.01 ETH) as fallback
    return '10000000000000000';
  }
}

// Helper to add auth headers
function authHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (ADMIN_API_KEY) {
    headers['X-API-Key'] = ADMIN_API_KEY;
  }
  
  return headers;
}

export interface PromoCode {
  id: number;
  code: string;
  discount_fee: string;
  expires_at: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

export interface CreatePromoCodeData {
  code: string;
  discountType: 'free' | 'percentage';
  discountValue?: number;
  expiresAt: number;
  maxUses: number;
}

export interface AdminStats {
  promoCodes: {
    total: number;
    totalUses: number;
    active: number;
  };
}

export type TokenType = 'ethereum-enabled' | 'celo-native';

export interface Token {
  id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  owner: string;
  type: TokenType; // 'ethereum-enabled' or 'celo-native'
  addressL1?: string;
  addressL2?: string;
  createdAt: string;
  // Mocked metrics (not available from subgraph)
  uniqueHolders: number;
  totalTransfers: number;
  totalBridges: number;
}

export interface TokenStats {
  totalTokens: number;
  combinedHolders: number;
  combinedTransfers: number;
  combinedBridges: number;
}

// Promo Codes API
export async function fetchPromoCodes(): Promise<PromoCode[]> {
  const response = await fetch(`${API_BASE}/api/admin/promo-codes`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function createPromoCode(promoData: CreatePromoCodeData): Promise<PromoCode> {
  const response = await fetch(`${API_BASE}/api/admin/promo-codes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(promoData),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode> {
  const response = await fetch(`${API_BASE}/api/admin/promo-codes/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function deletePromoCode(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/promo-codes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const headers = authHeaders();
  console.log('🔑 Fetching admin stats:', { 
    hasApiKey: !!ADMIN_API_KEY,
    url: `${API_BASE}/api/admin/stats`
  });
  
  const response = await fetch(`${API_BASE}/api/admin/stats`, {
    headers,
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Verify API key is valid
export async function verifyApiKey(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/admin/verify`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Subgraph types and helpers
interface SubgraphToken {
  id: string;
  tokenAddress: string;
  owner: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  chain: string;
  remoteToken?: string;
  bridge?: string;
  createdAt: string;
}

interface SubgraphResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function querySubgraph<T>(
  url: string,
  query: string
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const result: SubgraphResponse<T> = await response.json();
    if (result.errors) {
      console.error('Subgraph errors:', result.errors);
      return null;
    }
    return result.data ?? null;
  } catch (error) {
    console.error('Error querying subgraph:', error);
    return null;
  }
}

// Query to get ALL tokens (not filtered by owner)
const GET_ALL_TOKENS_QUERY = `
  query GetAllTokens {
    tokens(first: 1000, orderBy: createdAt, orderDirection: desc) {
      id
      tokenAddress
      owner
      name
      symbol
      decimals
      initialSupply
      maxSupply
      chain
      remoteToken
      bridge
      createdAt
    }
  }
`;

export async function fetchTokensFromSubgraph(): Promise<Token[]> {
  // Fetch from both subgraphs
  const [ethereumResult, celoResult] = await Promise.all([
    querySubgraph<{ tokens: SubgraphToken[] }>(SUBGRAPH_URLS.ethereum, GET_ALL_TOKENS_QUERY),
    querySubgraph<{ tokens: SubgraphToken[] }>(SUBGRAPH_URLS.celo, GET_ALL_TOKENS_QUERY),
  ]);

  const l1Tokens = ethereumResult?.tokens ?? [];
  const l2Tokens = celoResult?.tokens ?? [];

  // Build lookup for L2 tokens by their remoteToken (L1 address)
  const l2ByRemoteToken = new Map<string, SubgraphToken>();
  l2Tokens.forEach((token) => {
    if (token.remoteToken) {
      l2ByRemoteToken.set(token.remoteToken.toLowerCase(), token);
    }
  });

  // Track which L2 tokens are linked to L1
  const linkedL2Addresses = new Set<string>();

  const allTokens: Token[] = [];

  // Process L1 tokens (ethereum-enabled)
  l1Tokens.forEach((token) => {
    const l1Addr = token.tokenAddress.toLowerCase();
    const linkedL2 = l2ByRemoteToken.get(l1Addr);
    
    if (linkedL2) {
      linkedL2Addresses.add(linkedL2.tokenAddress.toLowerCase());
    }

    allTokens.push({
      id: token.id,
      tokenAddress: token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      initialSupply: token.initialSupply,
      maxSupply: token.maxSupply,
      owner: token.owner,
      type: 'ethereum-enabled',
      addressL1: token.tokenAddress,
      addressL2: linkedL2?.tokenAddress,
      createdAt: token.createdAt,
      // Mock metrics
      uniqueHolders: generateMockMetric(token.tokenAddress, 100, 5000),
      totalTransfers: generateMockMetric(token.tokenAddress, 500, 20000),
      totalBridges: linkedL2 ? generateMockMetric(token.tokenAddress, 10, 1000) : 0,
    });
  });

  // Process L2-only tokens (celo-native) - tokens without remoteToken
  l2Tokens.forEach((token) => {
    const l2Addr = token.tokenAddress.toLowerCase();
    
    // Skip if this L2 token is linked to an L1 token (already processed)
    if (linkedL2Addresses.has(l2Addr) || token.remoteToken) {
      return;
    }

    allTokens.push({
      id: token.id,
      tokenAddress: token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      initialSupply: token.initialSupply,
      maxSupply: token.maxSupply,
      owner: token.owner,
      type: 'celo-native',
      addressL2: token.tokenAddress,
      createdAt: token.createdAt,
      // Mock metrics
      uniqueHolders: generateMockMetric(token.tokenAddress, 50, 3000),
      totalTransfers: generateMockMetric(token.tokenAddress, 200, 10000),
      totalBridges: 0, // Celo-native tokens don't have bridges
    });
  });

  // Sort by creation date descending
  allTokens.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));

  return allTokens;
}

// Generate deterministic mock metric based on address hash
function generateMockMetric(address: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return min + Math.abs(hash) % (max - min);
}

export async function fetchTokenStats(): Promise<TokenStats> {
  const tokens = await fetchTokensFromSubgraph();
  return {
    totalTokens: tokens.length,
    combinedHolders: tokens.reduce((sum, t) => sum + t.uniqueHolders, 0),
    combinedTransfers: tokens.reduce((sum, t) => sum + t.totalTransfers, 0),
    combinedBridges: tokens.reduce((sum, t) => sum + t.totalBridges, 0),
  };
}
