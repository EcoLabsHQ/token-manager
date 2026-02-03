import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { SUBGRAPH_URLS, QUERIES } from '@/config/subgraph';
import { formatUnits } from 'viem';

export interface PendingOwnershipTransfer {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  maxSupply: string;
  maxSupplyFormatted: string;
  previousOwner: string;
  newOwner: string;
  chain: string;
  remoteToken?: string;
  bridge?: string;
  createdAt: number;
  createdTxHash: string;
  // For Ethereum Enabled tokens - paired L1/L2 tokens
  isEthereumEnabled?: boolean;
  l1TokenAddress?: string;
  l2TokenAddress?: string;
  pairedTransfer?: PendingOwnershipTransfer;
}

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

interface SubgraphPendingTransfer {
  id: string;
  previousOwner: string;
  newOwner: string;
  createdAt: string;
  createdAtBlock: string;
  createdTxHash: string;
  token: SubgraphToken;
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

export function usePendingOwnershipTransfers() {
  const { address, isConnected } = useAccount();
  const [pendingTransfers, setPendingTransfers] = useState<PendingOwnershipTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingTransfers = useCallback(async () => {
    if (!address || !isConnected) {
      setPendingTransfers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newOwnerAddress = address.toLowerCase();

      // Fetch pending transfers from both L1 and L2 subgraphs
      const [l1Result, l2Result] = await Promise.all([
        querySubgraph<{ pendingOwnershipTransfers: SubgraphPendingTransfer[] }>(
          SUBGRAPH_URLS.ethereum,
          QUERIES.getPendingOwnershipTransfersByNewOwner,
          { newOwner: newOwnerAddress }
        ),
        querySubgraph<{ pendingOwnershipTransfers: SubgraphPendingTransfer[] }>(
          SUBGRAPH_URLS.celo,
          QUERIES.getPendingOwnershipTransfersByNewOwner,
          { newOwner: newOwnerAddress }
        ),
      ]);

      const l1Transfers = l1Result?.pendingOwnershipTransfers ?? [];
      const l2Transfers = l2Result?.pendingOwnershipTransfers ?? [];

      // Format individual transfers
      const formattedL1 = l1Transfers.map((transfer) => formatTransfer(transfer, 'ethereum'));
      const formattedL2 = l2Transfers.map((transfer) => formatTransfer(transfer, 'celo'));

      // Group Ethereum Enabled tokens (L2 tokens with remoteToken pointing to L1)
      const pairedTransfers: PendingOwnershipTransfer[] = [];
      const standaloneTransfers: PendingOwnershipTransfer[] = [];
      const usedL1Ids = new Set<string>();
      const usedL2Ids = new Set<string>();

      // Check L2 transfers that have remoteToken (pointing to L1)
      for (const l2Transfer of formattedL2) {
        // Check if this L2 token has a remoteToken (L1 token address)
        if (l2Transfer.remoteToken && l2Transfer.remoteToken !== '0x0000000000000000000000000000000000000000') {
          // Find the corresponding L1 transfer
          const matchingL1 = formattedL1.find(
            (l1) => l1.tokenAddress.toLowerCase() === l2Transfer.remoteToken?.toLowerCase()
          );

          if (matchingL1) {
            // This is an Ethereum Enabled pair - both have pending transfers
            usedL1Ids.add(matchingL1.id);
            usedL2Ids.add(l2Transfer.id);
            pairedTransfers.push({
              ...matchingL1,
              isEthereumEnabled: true,
              chain: 'ethereum', // Primary chain for display
              l1TokenAddress: matchingL1.tokenAddress,
              l2TokenAddress: l2Transfer.tokenAddress,
              pairedTransfer: l2Transfer,
            });
          } else {
            // L2 has remoteToken but L1 doesn't have pending transfer
            // This is a partial transfer - show just the L2
            standaloneTransfers.push({
              ...l2Transfer,
              isEthereumEnabled: true,
              l1TokenAddress: l2Transfer.remoteToken,
              l2TokenAddress: l2Transfer.tokenAddress,
            });
            usedL2Ids.add(l2Transfer.id);
          }
        }
      }

      // Add remaining L1 transfers that weren't paired
      for (const l1Transfer of formattedL1) {
        if (!usedL1Ids.has(l1Transfer.id)) {
          // Standalone L1 token
          standaloneTransfers.push(l1Transfer);
        }
      }

      // Add remaining L2 transfers that weren't paired (Celo-native tokens)
      for (const l2Transfer of formattedL2) {
        if (!usedL2Ids.has(l2Transfer.id)) {
          // Standalone L2 token (Celo-native, no remoteToken)
          standaloneTransfers.push(l2Transfer);
        }
      }

      // Combine paired and standalone transfers
      const allTransfers: PendingOwnershipTransfer[] = [
        ...pairedTransfers,
        ...standaloneTransfers,
      ];

      // Sort by creation date (newest first)
      allTransfers.sort((a, b) => b.createdAt - a.createdAt);

      setPendingTransfers(allTransfers);
    } catch (err) {
      console.error('Error fetching pending transfers:', err);
      setError(err instanceof Error ? err.message : 'Error fetching pending transfers');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchPendingTransfers();
  }, [fetchPendingTransfers]);

  return {
    pendingTransfers,
    isLoading,
    error,
    refetch: fetchPendingTransfers,
  };
}

function formatTransfer(
  transfer: SubgraphPendingTransfer,
  chain: string
): PendingOwnershipTransfer {
  const formattedMaxSupply = formatUnits(
    BigInt(transfer.token.maxSupply),
    transfer.token.decimals
  );

  return {
    id: transfer.id,
    tokenAddress: transfer.token.tokenAddress,
    tokenName: transfer.token.name,
    tokenSymbol: transfer.token.symbol,
    tokenDecimals: transfer.token.decimals,
    maxSupply: transfer.token.maxSupply,
    maxSupplyFormatted: parseFloat(formattedMaxSupply).toLocaleString(),
    previousOwner: transfer.previousOwner,
    newOwner: transfer.newOwner,
    chain,
    remoteToken: transfer.token.remoteToken,
    bridge: transfer.token.bridge,
    createdAt: parseInt(transfer.createdAt),
    createdTxHash: transfer.createdTxHash,
  };
}
