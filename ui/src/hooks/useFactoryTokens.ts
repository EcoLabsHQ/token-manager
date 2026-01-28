import { useReadContract, useReadContracts } from 'wagmi';
import { getAddress, formatUnits } from 'viem';
import { useMemo } from 'react';
import { CONTRACTS, L1_TOKEN_FACTORY_ABI, L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_FACTORY_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface FactoryToken {
  id: string;
  address: `0x${string}`;
  name: string;
  symbol: string;
  type: 'celo-native' | 'ethereum-enabled';
  maxSupply: string;
  totalSupply?: string;
  decimals: number;
  addressL1?: string;
  addressL2?: string;
  owner?: string;
  chainId: number;
  remoteToken?: `0x${string}`;
}

// Helper to format address for display (kept for potential future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper to format supply with commas
const formatSupply = (supply: bigint, decimals: number): string => {
  const formatted = formatUnits(supply, decimals);
  const num = parseFloat(formatted);
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export const useFactoryTokens = () => {
  // Get all L1 tokens from factory
  const { data: l1TokenAddresses, isLoading: l1Loading, refetch: refetchL1 } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  });

  // Get all L2 tokens from factory
  const { data: l2TokenAddresses, isLoading: l2Loading, refetch: refetchL2 } = useReadContract({
    address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
    abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
  });

  // Build L1 token detail contracts
  const l1Tokens = (l1TokenAddresses as `0x${string}`[] | undefined) || [];
  const l1TokenContracts = useMemo(() => 
    l1Tokens.flatMap((addr) => [
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'name', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'symbol', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'decimals', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'maxSupply', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'totalSupply', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
      { address: addr, abi: L1_TOKEN_ABI, functionName: 'owner', chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId },
    ]),
  [l1Tokens]);

  const { data: l1TokenDetails, isLoading: l1DetailsLoading } = useReadContracts({
    contracts: l1TokenContracts as any,
    query: { enabled: l1TokenContracts.length > 0 },
  });

  // Build L2 token detail contracts
  const l2Tokens = (l2TokenAddresses as `0x${string}`[] | undefined) || [];
  const l2TokenContracts = useMemo(() =>
    l2Tokens.flatMap((addr) => [
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'name', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'symbol', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'decimals', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'maxSupply', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'totalSupply', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'owner', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
      { address: addr, abi: L2_SUPERCHAIN_TOKEN_ABI, functionName: 'remoteToken', chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId },
    ]),
  [l2Tokens]);

  const { data: l2TokenDetails, isLoading: l2DetailsLoading } = useReadContracts({
    contracts: l2TokenContracts as any,
    query: { enabled: l2TokenContracts.length > 0 },
  });

  // Parse L1 token details
  const l1TokensWithDetails: FactoryToken[] = useMemo(() => {
    if (!l1TokenDetails) return [];
    const fieldsPerToken = 6;
    
    return l1Tokens.map((addr, index) => {
      const baseIndex = index * fieldsPerToken;
      const nameResult = l1TokenDetails[baseIndex];
      const symbolResult = l1TokenDetails[baseIndex + 1];
      const decimalsResult = l1TokenDetails[baseIndex + 2];
      const maxSupplyResult = l1TokenDetails[baseIndex + 3];
      const totalSupplyResult = l1TokenDetails[baseIndex + 4];
      const ownerResult = l1TokenDetails[baseIndex + 5];
      
      const decimals = decimalsResult?.status === 'success' ? Number(decimalsResult.result) : 18;
      const maxSupply = maxSupplyResult?.status === 'success' ? (maxSupplyResult.result as bigint) : BigInt(0);
      const totalSupply = totalSupplyResult?.status === 'success' ? (totalSupplyResult.result as bigint) : BigInt(0);
      
      return {
        id: `l1-${addr}`,
        address: addr,
        name: nameResult?.status === 'success' ? (nameResult.result as string) : 'Unknown',
        symbol: symbolResult?.status === 'success' ? (symbolResult.result as string) : '???',
        type: 'ethereum-enabled' as const,
        decimals,
        maxSupply: formatSupply(maxSupply, decimals),
        totalSupply: formatSupply(totalSupply, decimals),
        addressL1: addr,
        owner: ownerResult?.status === 'success' ? (ownerResult.result as string) : undefined,
        chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
      };
    });
  }, [l1Tokens, l1TokenDetails]);

  // Parse L2 token details
  const l2TokensWithDetails: FactoryToken[] = useMemo(() => {
    if (!l2TokenDetails) return [];
    const fieldsPerToken = 7; // includes remoteToken
    
    return l2Tokens.map((addr, index) => {
      const baseIndex = index * fieldsPerToken;
      const nameResult = l2TokenDetails[baseIndex];
      const symbolResult = l2TokenDetails[baseIndex + 1];
      const decimalsResult = l2TokenDetails[baseIndex + 2];
      const maxSupplyResult = l2TokenDetails[baseIndex + 3];
      const totalSupplyResult = l2TokenDetails[baseIndex + 4];
      const ownerResult = l2TokenDetails[baseIndex + 5];
      const remoteTokenResult = l2TokenDetails[baseIndex + 6];
      
      const decimals = decimalsResult?.status === 'success' ? Number(decimalsResult.result) : 18;
      const maxSupply = maxSupplyResult?.status === 'success' ? (maxSupplyResult.result as bigint) : BigInt(0);
      const totalSupply = totalSupplyResult?.status === 'success' ? (totalSupplyResult.result as bigint) : BigInt(0);
      const remoteToken = remoteTokenResult?.status === 'success' ? (remoteTokenResult.result as `0x${string}`) : undefined;
      const hasRemoteToken = remoteToken && remoteToken !== '0x0000000000000000000000000000000000000000';
      
      return {
        id: `l2-${addr}`,
        address: addr,
        name: nameResult?.status === 'success' ? (nameResult.result as string) : 'Unknown',
        symbol: symbolResult?.status === 'success' ? (symbolResult.result as string) : '???',
        type: hasRemoteToken ? 'ethereum-enabled' as const : 'celo-native' as const,
        decimals,
        maxSupply: formatSupply(maxSupply, decimals),
        totalSupply: formatSupply(totalSupply, decimals),
        addressL1: hasRemoteToken ? remoteToken! : undefined,
        addressL2: addr,
        owner: ownerResult?.status === 'success' ? (ownerResult.result as string) : undefined,
        chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
        remoteToken: hasRemoteToken ? remoteToken : undefined,
      };
    });
  }, [l2Tokens, l2TokenDetails]);

  // Combine: L2 tokens (with remote info) are the primary view
  // L1 tokens that don't have a matching L2 are shown separately
  const allTokens = useMemo(() => {
    const l2Set = new Set(l2TokensWithDetails.map(t => t.remoteToken).filter(Boolean));
    const unmatchedL1 = l1TokensWithDetails.filter(t => !l2Set.has(t.address));
    return [...l2TokensWithDetails, ...unmatchedL1];
  }, [l1TokensWithDetails, l2TokensWithDetails]);

  const refetch = async () => {
    await Promise.all([refetchL1(), refetchL2()]);
  };

  const isLoading = l1Loading || l2Loading || l1DetailsLoading || l2DetailsLoading;

  return {
    tokens: allTokens,
    l1Tokens: l1TokensWithDetails,
    l2Tokens: l2TokensWithDetails,
    l1TokenCount: l1Tokens.length,
    l2TokenCount: l2Tokens.length,
    allL1Addresses: l1Tokens,
    allL2Addresses: l2Tokens,
    isLoading,
    refetch,
  };
};
