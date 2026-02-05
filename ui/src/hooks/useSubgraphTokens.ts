import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { SUBGRAPH_URLS, QUERIES } from '@/config/subgraph';
import { formatUnits } from 'viem';

export interface SubgraphToken {
  id: string;
  tokenAddress: string;
  owner: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  totalSupply?: string; // Optional - will be added when subgraph is redeployed
  totalUniqueHolders?: string; // Optional - will be added when subgraph is redeployed
  chain: string;
  remoteToken?: string;
  bridge?: string;
  createdAt: string;
}

export type TokenSetupStatus = 'complete' | 'pending-l2' | 'pending-bridge';

export interface TokenPair {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: string;
  maxSupplyFormatted: string;
  totalSupply: string;
  totalSupplyFormatted: string;
  totalUniqueHolders: number;
  type: 'ethereum-enabled' | 'celo-native';
  address: string; // Primary address for routing
  addressL1?: string;
  addressL2?: string;
  remoteToken?: string;
  bridgeAddress?: string;
  createdAt: number;
  setupStatus: TokenSetupStatus; // Track if token setup is complete
}

interface SubgraphResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function querySubgraph<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
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

export function useSubgraphTokens() {
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState<TokenPair[]>([]);
  const [l1TokenCount, setL1TokenCount] = useState(0);
  const [l2TokenCount, setL2TokenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!address || !isConnected) {
      setTokens([]);
      setL1TokenCount(0);
      setL2TokenCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ownerAddress = address.toLowerCase();

      // Step 1: Fetch L1 tokens by owner from minter-ethereum
      const l1Result = await querySubgraph<{ tokens: SubgraphToken[] }>(
        SUBGRAPH_URLS.ethereum,
        QUERIES.getL1TokensByOwner,
        { owner: ownerAddress }
      );

      const l1Tokens = l1Result?.tokens ?? [];
      setL1TokenCount(l1Tokens.length);

      // Step 2: Fetch L2 tokens by owner from minter-celo
      const l2ByOwnerResult = await querySubgraph<{ tokens: SubgraphToken[] }>(
        SUBGRAPH_URLS.celo,
        QUERIES.getL2TokensByOwner,
        { owner: ownerAddress }
      );

      const l2TokensByOwner = l2ByOwnerResult?.tokens ?? [];

      // Step 3: Find L2 tokens linked to L1 tokens (via remoteToken)
      let l2TokensLinkedToL1: SubgraphToken[] = [];
      if (l1Tokens.length > 0) {
        const l1Addresses = l1Tokens.map((t) => t.tokenAddress.toLowerCase());
        const l2LinkedResult = await querySubgraph<{ tokens: SubgraphToken[] }>(
          SUBGRAPH_URLS.celo,
          QUERIES.getL2TokensByRemoteTokens,
          { remoteTokens: l1Addresses }
        );
        l2TokensLinkedToL1 = l2LinkedResult?.tokens ?? [];
      }

      // Combine L2 tokens (by owner + linked to L1), avoiding duplicates
      const l2TokenMap = new Map<string, SubgraphToken>();
      l2TokensByOwner.forEach((t) => l2TokenMap.set(t.tokenAddress.toLowerCase(), t));
      l2TokensLinkedToL1.forEach((t) => l2TokenMap.set(t.tokenAddress.toLowerCase(), t));
      const l2Tokens = Array.from(l2TokenMap.values());

      setL2TokenCount(l2Tokens.length);

      // Create lookup maps
      const l1ByAddress = new Map<string, SubgraphToken>();
      l1Tokens.forEach((token) => {
        l1ByAddress.set(token.tokenAddress.toLowerCase(), token);
      });

      // Create L2 lookup by remote token (L1 address)
      const l2ByRemoteToken = new Map<string, SubgraphToken>();
      l2Tokens.forEach((token) => {
        if (token.remoteToken) {
          l2ByRemoteToken.set(token.remoteToken.toLowerCase(), token);
        }
      });

      // Build token pairs
      const tokenPairs: TokenPair[] = [];
      const processedL2Addresses = new Set<string>();

      // Process L1 tokens and find their L2 counterparts
      l1Tokens.forEach((l1Token) => {
        const l1Addr = l1Token.tokenAddress.toLowerCase();
        const linkedL2 = l2ByRemoteToken.get(l1Addr);

        const formattedMaxSupply = formatUnits(
          BigInt(l1Token.maxSupply),
          l1Token.decimals
        );

        // Use totalSupply if available from subgraph, otherwise fallback to initialSupply
        const currentTotalSupply = l1Token.totalSupply || l1Token.initialSupply;
        const formattedTotalSupply = formatUnits(
          BigInt(currentTotalSupply),
          l1Token.decimals
        );

        // Determine setup status
        let setupStatus: TokenSetupStatus = 'complete';
        if (!linkedL2) {
          setupStatus = 'pending-l2'; // L1 exists but no L2 token created yet
        } else if (!linkedL2.bridge) {
          setupStatus = 'pending-bridge'; // L2 exists but bridge not configured
        }

        // For ethereum-enabled tokens, sum L1 + L2 holders
        const l1Holders = parseInt(l1Token.totalUniqueHolders || '0');
        const l2Holders = linkedL2 ? parseInt(linkedL2.totalUniqueHolders || '0') : 0;
        const combinedHolders = l1Holders + l2Holders;

        tokenPairs.push({
          id: l1Token.id,
          name: l1Token.name,
          symbol: l1Token.symbol,
          decimals: l1Token.decimals,
          maxSupply: l1Token.maxSupply,
          maxSupplyFormatted: parseFloat(formattedMaxSupply).toLocaleString(),
          totalSupply: currentTotalSupply,
          totalSupplyFormatted: parseFloat(formattedTotalSupply).toLocaleString(),
          totalUniqueHolders: combinedHolders,
          type: 'ethereum-enabled',
          address: l1Token.tokenAddress,
          addressL1: l1Token.tokenAddress,
          addressL2: linkedL2?.tokenAddress,
          bridgeAddress: linkedL2?.bridge,
          createdAt: parseInt(l1Token.createdAt),
          setupStatus,
        });

        if (linkedL2) {
          processedL2Addresses.add(linkedL2.tokenAddress.toLowerCase());
        }
      });

      // Process standalone L2 tokens (not linked to any L1 we own)
      l2Tokens.forEach((l2Token) => {
        const l2Addr = l2Token.tokenAddress.toLowerCase();
        if (processedL2Addresses.has(l2Addr)) return;

        const formattedMaxSupply = formatUnits(
          BigInt(l2Token.maxSupply),
          l2Token.decimals
        );

        // Use totalSupply if available from subgraph, otherwise fallback to initialSupply
        const currentTotalSupply = l2Token.totalSupply || l2Token.initialSupply;
        const formattedTotalSupply = formatUnits(
          BigInt(currentTotalSupply),
          l2Token.decimals
        );

        // Check if it has a remote token (linked to L1 we don't own)
        const hasRemoteToken = !!l2Token.remoteToken;

        // Determine setup status for standalone L2 tokens
        let setupStatus: TokenSetupStatus = 'complete';
        if (hasRemoteToken && !l2Token.bridge) {
          setupStatus = 'pending-bridge';
        }

        tokenPairs.push({
          id: l2Token.id,
          name: l2Token.name,
          symbol: l2Token.symbol,
          decimals: l2Token.decimals,
          maxSupply: l2Token.maxSupply,
          maxSupplyFormatted: parseFloat(formattedMaxSupply).toLocaleString(),
          totalSupply: currentTotalSupply,
          totalSupplyFormatted: parseFloat(formattedTotalSupply).toLocaleString(),
          totalUniqueHolders: parseInt(l2Token.totalUniqueHolders || '0'),
          type: hasRemoteToken ? 'ethereum-enabled' : 'celo-native',
          address: l2Token.tokenAddress,
          addressL1: l2Token.remoteToken,
          addressL2: l2Token.tokenAddress,
          remoteToken: l2Token.remoteToken,
          bridgeAddress: l2Token.bridge,
          createdAt: parseInt(l2Token.createdAt),
          setupStatus,
        });
      });

      // Sort: incomplete tokens first, then by creation date (newest first)
      tokenPairs.sort((a, b) => {
        // Priority: pending-l2 > pending-bridge > complete
        const statusOrder = { 'pending-l2': 0, 'pending-bridge': 1, 'complete': 2 };
        const statusDiff = statusOrder[a.setupStatus] - statusOrder[b.setupStatus];
        if (statusDiff !== 0) return statusDiff;
        return b.createdAt - a.createdAt;
      });

      setTokens(tokenPairs);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setError(err instanceof Error ? err.message : 'Error fetching tokens');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return {
    tokens,
    l1TokenCount,
    l2TokenCount,
    isLoading,
    error,
    refetch: fetchTokens,
  };
}
