import { useReadContract, useReadContracts } from 'wagmi';
import { getAddress } from 'viem';
import { CONTRACTS, L1_TOKEN_FACTORY_ABI, L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_FACTORY_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface FactoryToken {
  address: `0x${string}`;
  name: string;
  symbol: string;
  chainId: number;
  type: 'institutional' | 'high-velocity' | 'l1';
  remoteToken?: `0x${string}`;
}

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

  // Get last 3 L1 token details (name, symbol)
  const l1Tokens = (l1TokenAddresses as `0x${string}`[] | undefined) || [];
  const l1First3 = l1Tokens.slice(-3);

  const l1TokenContracts = l1First3.flatMap((addr) => [
    {
      address: addr,
      abi: L1_TOKEN_ABI,
      functionName: 'name',
      chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
    },
    {
      address: addr,
      abi: L1_TOKEN_ABI,
      functionName: 'symbol',
      chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
    },
  ]);

  const { data: l1TokenDetails } = useReadContracts({
    contracts: l1TokenContracts as any,
  });

  // Get last 3 L2 token details (name, symbol)
  const l2Tokens = (l2TokenAddresses as `0x${string}`[] | undefined) || [];
  const l2First3 = l2Tokens.slice(-3);

  const l2TokenContracts = l2First3.flatMap((addr) => [
    {
      address: addr,
      abi: L2_SUPERCHAIN_TOKEN_ABI,
      functionName: 'name',
      chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    },
    {
      address: addr,
      abi: L2_SUPERCHAIN_TOKEN_ABI,
      functionName: 'symbol',
      chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    },
    {
      address: addr,
      abi: L2_SUPERCHAIN_TOKEN_ABI,
      functionName: 'remoteToken',
      chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    },
  ]);

  const { data: l2TokenDetails } = useReadContracts({
    contracts: l2TokenContracts as any,
  });

  // Parse L1 token details - L1 tokens don't have a type badge
  const l1TokensWithDetails: FactoryToken[] = l1First3.map((addr, index) => {
    const nameResult = l1TokenDetails?.[index * 2];
    const symbolResult = l1TokenDetails?.[index * 2 + 1];
    return {
      address: addr,
      name: (nameResult?.result as string) || 'Unknown',
      symbol: (symbolResult?.result as string) || '???',
      chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
      type: 'l1' as const,
    };
  });

  // Parse L2 token details - check remoteToken to determine type
  const l2TokensWithDetails: FactoryToken[] = l2First3.map((addr, index) => {
    const nameResult = l2TokenDetails?.[index * 3];
    const symbolResult = l2TokenDetails?.[index * 3 + 1];
    const remoteTokenResult = l2TokenDetails?.[index * 3 + 2];
    const remoteToken = remoteTokenResult?.result as `0x${string}` | undefined;
    const hasRemoteToken = remoteToken && remoteToken !== '0x0000000000000000000000000000000000000000';
    
    return {
      address: addr,
      name: (nameResult?.result as string) || 'Unknown',
      symbol: (symbolResult?.result as string) || '???',
      chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
      type: hasRemoteToken ? 'institutional' as const : 'high-velocity' as const,
      remoteToken: hasRemoteToken ? remoteToken : undefined,
    };
  });

  const refetch = async () => {
    await Promise.all([refetchL1(), refetchL2()]);
  };

  return {
    l1Tokens: l1TokensWithDetails,
    l2Tokens: l2TokensWithDetails,
    l1TokenCount: l1Tokens.length,
    l2TokenCount: l2Tokens.length,
    allL1Addresses: l1Tokens,
    allL2Addresses: l2Tokens,
    isLoading: l1Loading || l2Loading,
    refetch,
  };
};
