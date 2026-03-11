import { useAccount, useWriteContract, useReadContract, useReadContracts, useSwitchChain, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useState, useCallback } from 'react';
import { parseUnits, formatUnits, getAddress } from 'viem';
import { CONTRACTS, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface TokenManagerParams {
  tokenAddress: string | undefined;
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
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const expectedChainId = isL2Token 
    ? CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId 
    : CONTRACTS.L1_TOKEN_FACTORY.chainId;

  const isCorrectChain = chainId === expectedChainId;

  // Read token data
  const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
    contracts: tokenAddress ? [
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
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'pendingOwner',
        chainId: expectedChainId,
      },
      {
        address: getAddress(tokenAddress),
        abi: TOKEN_ABI,
        functionName: 'metadataURI',
        chainId: expectedChainId,
      },
    ] : [],
    query: {
      enabled: !!tokenAddress,
    },
  });

  // Read user balance
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress ? getAddress(tokenAddress) : undefined,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: expectedChainId,
    query: {
      enabled: !!address && !!tokenAddress,
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
  const pendingOwner = tokenData?.[7]?.result as string | undefined;
  const metadataURI = tokenData?.[8]?.result as string | undefined;

  const isOwner = address && owner ? address.toLowerCase() === owner.toLowerCase() : false;
  const isPendingOwner = address && pendingOwner && pendingOwner !== '0x0000000000000000000000000000000000000000' 
    ? address.toLowerCase() === pendingOwner.toLowerCase() 
    : false;
  const hasPendingTransfer = pendingOwner && pendingOwner !== '0x0000000000000000000000000000000000000000';

  // Helper to execute transaction with auto chain switch
  const executeTransaction = useCallback(
    async (
      functionName: string,
      args: unknown[],
      successMessage?: string
    ): Promise<TransactionResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }
      
      if (!tokenAddress) {
        return { success: false, error: 'Token address not set' };
      }

      setIsLoading(true);
      setError(null);

      try {
        // Auto switch chain if needed
        if (chainId !== expectedChainId) {
          console.log(`Auto-switching chain from ${chainId} to ${expectedChainId}...`);
          setIsSwitchingChain(true);
          try {
            await switchChainAsync({ chainId: expectedChainId });
            // Small delay to ensure wallet is ready after chain switch
            await new Promise(resolve => setTimeout(resolve, 500));
            setIsSwitchingChain(false);
          } catch (switchErr) {
            setIsSwitchingChain(false);
            const msg = switchErr instanceof Error ? switchErr.message : 'Chain switch failed';
            setError(msg);
            setIsLoading(false);
            return { success: false, error: msg };
          }
        }

        const txHash = await writeContractAsync({
          address: getAddress(tokenAddress),
          abi: TOKEN_ABI,
          functionName: functionName as any,
          args: args as any,
          chainId: expectedChainId,
        });

        setLastTxHash(txHash);

        // Wait for confirmation using the correct chain's public client
        // Get the client dynamically to ensure we're using the right chain after switch
        const targetPublicClient = getPublicClient(config, { chainId: expectedChainId });
        if (targetPublicClient) {
          const receipt = await targetPublicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });

          // Check if transaction was reverted
          if (receipt.status === 'reverted') {
            setError('Transaction reverted on chain');
            setIsLoading(false);
            return { success: false, error: 'Transaction reverted on chain', txHash };
          }
        }

        // Small delay to ensure RPC state is updated (especially for Celo L2)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Refetch data after transaction
        await Promise.all([refetchTokenData(), refetchBalance()]);

        // Double refetch after a short delay to catch any RPC propagation delays
        setTimeout(() => {
          refetchTokenData();
          refetchBalance();
        }, 2000);

        console.log(successMessage || `${functionName} successful:`, txHash);
        setIsLoading(false);
        return { success: true, txHash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
        setError(errorMessage);
        setIsLoading(false);
        setIsSwitchingChain(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, chainId, expectedChainId, tokenAddress, writeContractAsync, switchChainAsync, config, refetchTokenData, refetchBalance]
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

  // Transfer ownership - Step 1 (owner only)
  const transferOwnership = useCallback(
    async (newOwner: string): Promise<TransactionResult> => {
      if (!isOwner) {
        return { success: false, error: 'Only owner can transfer ownership' };
      }
      return executeTransaction('transferOwnership', [getAddress(newOwner)], 'Ownership transfer initiated');
    },
    [isOwner, executeTransaction]
  );

  // Accept ownership - Step 2 (pending owner only)
  const acceptOwnership = useCallback(
    async (): Promise<TransactionResult> => {
      if (!isPendingOwner) {
        return { success: false, error: 'Only pending owner can accept ownership' };
      }
      return executeTransaction('acceptOwnership', [], 'Ownership accepted');
    },
    [isPendingOwner, executeTransaction]
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
    metadataURI: metadataURI ?? '',
    owner,
    pendingOwner,
    isPaused: isPaused ?? false,
    hasPendingTransfer: hasPendingTransfer ?? false,
    
    // User info
    userAddress: address,
    userBalance: formattedBalance,
    isOwner,
    isPendingOwner,
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
    acceptOwnership,
    setMaxSupply,
    
    // State
    isLoading,
    isSwitchingChain,
    error,
    lastTxHash,
    
    // Refetch
    refetch: () => Promise.all([refetchTokenData(), refetchBalance()]),
  };
};
