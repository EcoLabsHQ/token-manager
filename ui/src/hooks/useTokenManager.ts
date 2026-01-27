import { useAccount, useWriteContract, useReadContract, usePublicClient, useReadContracts } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { parseUnits, formatUnits, getAddress } from 'viem';
import { CONTRACTS, L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface TokenManagerParams {
  tokenAddress: string;
  isL2Token: boolean;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// Common ABI for both L1 and L2 tokens (they share most functions)
const TOKEN_ABI = [
  ...L2_SUPERCHAIN_TOKEN_ABI,
  // Add transferOwnership for Ownable2Step
  {
    name: 'transferOwnership',
    type: 'function',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'pendingOwner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'acceptOwnership',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const useTokenManager = ({ tokenAddress, isL2Token }: TokenManagerParams) => {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const expectedChainId = isL2Token 
    ? CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId 
    : CONTRACTS.L1_TOKEN_FACTORY.chainId;

  const isCorrectChain = chainId === expectedChainId;

  // Read token data
  const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
    contracts: [
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'name',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'symbol',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'decimals',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'totalSupply',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'maxSupply',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'owner',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'paused',
        chainId: expectedChainId,
      },
    ],
  });

  // Read user balance
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: getAddress(tokenAddress),
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: expectedChainId,
    query: {
      enabled: !!address,
    },
  });

  // Extract token info from read results
  const name = tokenData?.[0]?.result as string | undefined;
  const symbol = tokenData?.[1]?.result as string | undefined;
  const decimals = (tokenData?.[2]?.result as number) ?? 18;
  const totalSupply = tokenData?.[3]?.result as bigint | undefined;
  const maxSupply = tokenData?.[4]?.result as bigint | undefined;
  const owner = tokenData?.[5]?.result as string | undefined;
  const isPaused = tokenData?.[6]?.result as boolean | undefined;

  const isOwner = address && owner ? address.toLowerCase() === owner.toLowerCase() : false;

  // Helper to execute transaction
  const executeTransaction = useCallback(
    async (
      functionName: string,
      args: unknown[],
      successMessage?: string
    ): Promise<TransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      // Chain switching is handled by the UI - writeContractAsync uses explicit chainId

      setIsLoading(true);
      setError(null);

      try {
        const txHash = await writeContractAsync({
          address: getAddress(tokenAddress),
          abi: TOKEN_ABI,
          functionName: functionName as any,
          args: args as any,
          chainId: expectedChainId,
        });

        setLastTxHash(txHash);

        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });
        }

        // Refetch data after transaction
        await Promise.all([refetchTokenData(), refetchBalance()]);

        console.log(successMessage || `${functionName} successful:`, txHash);
        setIsLoading(false);
        return { success: true, txHash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, isCorrectChain, isL2Token, tokenAddress, writeContractAsync, publicClient, refetchTokenData, refetchBalance]
  );

  // Transfer tokens
  const transfer = useCallback(
    async (to: string, amount: string): Promise<TransactionResult> => {
      const amountBigInt = parseUnits(amount, decimals);
      return executeTransaction('transfer', [getAddress(to), amountBigInt], 'Transfer successful');
    },
    [decimals, executeTransaction]
  );

  // Mint tokens (owner only)
  const mint = useCallback(
    async (to: string, amount: string): Promise<TransactionResult> => {
      if (!isOwner) {
        return { success: false, error: 'Only owner can mint tokens' };
      }
      const amountBigInt = parseUnits(amount, decimals);
      return executeTransaction('mint', [getAddress(to), amountBigInt], 'Mint successful');
    },
    [decimals, isOwner, executeTransaction]
  );

  // Burn tokens
  const burn = useCallback(
    async (amount: string): Promise<TransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }
      const amountBigInt = parseUnits(amount, decimals);
      return executeTransaction('burn', [getAddress(address), amountBigInt], 'Burn successful');
    },
    [address, decimals, executeTransaction]
  );

  // Pause contract (owner only)
  const pause = useCallback(async (): Promise<TransactionResult> => {
    if (!isOwner) {
      return { success: false, error: 'Only owner can pause the contract' };
    }
    return executeTransaction('pause', [], 'Contract paused');
  }, [isOwner, executeTransaction]);

  // Unpause contract (owner only)
  const unpause = useCallback(async (): Promise<TransactionResult> => {
    if (!isOwner) {
      return { success: false, error: 'Only owner can unpause the contract' };
    }
    return executeTransaction('unpause', [], 'Contract unpaused');
  }, [isOwner, executeTransaction]);

  // Transfer ownership (owner only)
  const transferOwnership = useCallback(
    async (newOwner: string): Promise<TransactionResult> => {
      if (!isOwner) {
        return { success: false, error: 'Only owner can transfer ownership' };
      }
      return executeTransaction('transferOwnership', [getAddress(newOwner)], 'Ownership transfer initiated');
    },
    [isOwner, executeTransaction]
  );

  // Set max supply (owner only)
  const setMaxSupply = useCallback(
    async (newMaxSupply: string): Promise<TransactionResult> => {
      if (!isOwner) {
        return { success: false, error: 'Only owner can set max supply' };
      }
      const maxSupplyBigInt = parseUnits(newMaxSupply, decimals);
      return executeTransaction('setMaxSupply', [maxSupplyBigInt], 'Max supply updated');
    },
    [decimals, isOwner, executeTransaction]
  );

  // Format balance for display
  const formattedBalance = userBalance 
    ? formatUnits(userBalance as bigint, decimals)
    : '0';

  const formattedTotalSupply = totalSupply 
    ? formatUnits(totalSupply, decimals)
    : '0';

  const formattedMaxSupply = maxSupply 
    ? formatUnits(maxSupply, decimals)
    : '0';

  return {
    // Token info
    name,
    symbol,
    decimals,
    totalSupply: formattedTotalSupply,
    maxSupply: formattedMaxSupply,
    owner,
    isPaused: isPaused ?? false,
    
    // User info
    userAddress: address,
    userBalance: formattedBalance,
    isOwner,
    isConnected: !!address,
    isCorrectChain,
    expectedChainId,
    
    // Actions
    transfer,
    mint,
    burn,
    pause,
    unpause,
    transferOwnership,
    setMaxSupply,
    
    // State
    isLoading,
    error,
    lastTxHash,
    
    // Refetch
    refetch: () => Promise.all([refetchTokenData(), refetchBalance()]),
  };
};
