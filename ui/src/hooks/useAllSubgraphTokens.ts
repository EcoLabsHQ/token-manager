import { useState, useEffect, useCallback } from 'react';
import { SUBGRAPH_URLS, QUERIES } from '@/config/subgraph';
import { formatUnits } from 'viem';
import type { TokenPair, TokenSetupStatus, SubgraphToken } from './useSubgraphTokens';

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
      headers: { 'Content-Type': 'application/json' },
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

export function useAllSubgraphTokens() {
  const [tokens, setTokens] = useState<TokenPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all L1 tokens
      const l1Result = await querySubgraph<{ tokens: SubgraphToken[] }>(
        SUBGRAPH_URLS.ethereum,
        QUERIES.getAllL1Tokens,
        { first: 100, skip: 0 }
      );
      const l1Tokens = l1Result?.tokens ?? [];

      // Fetch all L2 tokens
      const l2Result = await querySubgraph<{ tokens: SubgraphToken[] }>(
        SUBGRAPH_URLS.celo,
        QUERIES.getAllL2Tokens,
        { first: 100, skip: 0 }
      );
      const l2Tokens = l2Result?.tokens ?? [];

      // Build lookup maps
      const l1ByAddress = new Map<string, SubgraphToken>();
      l1Tokens.forEach(t => l1ByAddress.set(t.tokenAddress.toLowerCase(), t));

      const l2ByRemoteToken = new Map<string, SubgraphToken>();
      l2Tokens.forEach(t => {
        if (t.remoteToken) l2ByRemoteToken.set(t.remoteToken.toLowerCase(), t);
      });

      const tokenPairs: TokenPair[] = [];
      const processedL2Addresses = new Set<string>();

      // Process L1 tokens → find matching L2
      l1Tokens.forEach(l1Token => {
        const l1Addr = l1Token.tokenAddress.toLowerCase();
        const linkedL2 = l2ByRemoteToken.get(l1Addr);

        const currentTotalSupply = l1Token.totalSupply || l1Token.initialSupply;
        const formattedMaxSupply = parseFloat(
          formatUnits(BigInt(l1Token.maxSupply), l1Token.decimals)
        );

        let setupStatus: TokenSetupStatus = 'complete';
        if (!linkedL2) setupStatus = 'pending-l2';
        else if (!linkedL2.bridge) setupStatus = 'pending-bridge';

        const l1Holders = parseInt(l1Token.totalUniqueHolders || '0');
        const l2Holders = linkedL2 ? parseInt(linkedL2.totalUniqueHolders || '0') : 0;
        const combinedTransfers =
          parseInt(l1Token.totalTransfers || '0') +
          (linkedL2 ? parseInt(linkedL2.totalTransfers || '0') : 0);
        const combinedBridges =
          parseInt(l1Token.totalBridges || '0') +
          (linkedL2 ? parseInt(linkedL2.totalBridges || '0') : 0);

        // Use L2 totalSupply if available (more up-to-date for combined view)
        const l2TotalSupply = linkedL2?.totalSupply || linkedL2?.initialSupply;
        const combinedSupplyRaw = l2TotalSupply || currentTotalSupply;
        const combinedSupplyFormatted = parseFloat(
          formatUnits(BigInt(combinedSupplyRaw), l1Token.decimals)
        );

        tokenPairs.push({
          id: l1Token.id,
          name: l1Token.name,
          symbol: l1Token.symbol,
          decimals: l1Token.decimals,
          maxSupply: l1Token.maxSupply,
          maxSupplyFormatted: formattedMaxSupply.toLocaleString(),
          totalSupply: combinedSupplyRaw,
          totalSupplyFormatted: combinedSupplyFormatted.toLocaleString(),
          totalUniqueHolders: l1Holders + l2Holders,
          totalTransfers: combinedTransfers,
          totalBridges: combinedBridges,
          type: 'ethereum-enabled',
          address: l1Token.tokenAddress,
          addressL1: l1Token.tokenAddress,
          addressL2: linkedL2?.tokenAddress,
          bridgeAddress: linkedL2?.bridge,
          createdAt: parseInt(l1Token.createdAt),
          setupStatus,
        });

        if (linkedL2) processedL2Addresses.add(linkedL2.tokenAddress.toLowerCase());
      });

      // Process standalone L2 tokens
      l2Tokens.forEach(l2Token => {
        const l2Addr = l2Token.tokenAddress.toLowerCase();
        if (processedL2Addresses.has(l2Addr)) return;

        const currentTotalSupply = l2Token.totalSupply || l2Token.initialSupply;
        const formattedTotalSupply = parseFloat(
          formatUnits(BigInt(currentTotalSupply), l2Token.decimals)
        );
        const formattedMaxSupply = parseFloat(
          formatUnits(BigInt(l2Token.maxSupply), l2Token.decimals)
        );

        const hasRemoteToken = !!l2Token.remoteToken;
        let setupStatus: TokenSetupStatus = 'complete';
        if (hasRemoteToken && !l2Token.bridge) setupStatus = 'pending-bridge';

        tokenPairs.push({
          id: l2Token.id,
          name: l2Token.name,
          symbol: l2Token.symbol,
          decimals: l2Token.decimals,
          maxSupply: l2Token.maxSupply,
          maxSupplyFormatted: formattedMaxSupply.toLocaleString(),
          totalSupply: currentTotalSupply,
          totalSupplyFormatted: formattedTotalSupply.toLocaleString(),
          totalUniqueHolders: parseInt(l2Token.totalUniqueHolders || '0'),
          totalTransfers: parseInt(l2Token.totalTransfers || '0'),
          totalBridges: parseInt(l2Token.totalBridges || '0'),
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

      // Sort by total transfers descending (most active tokens first)
      tokenPairs.sort((a, b) => b.totalTransfers - a.totalTransfers);

      setTokens(tokenPairs);
    } catch (err) {
      console.error('Error fetching all tokens:', err);
      setError(err instanceof Error ? err.message : 'Error fetching tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, isLoading, error, refetch: fetchTokens };
}
