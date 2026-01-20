import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { parseUnits, getAddress, toHex } from 'viem';
import { CONTRACTS, L2_SUPERCHAIN_TOKEN_FACTORY_ABI } from '@/config/contracts';

export interface CreateL2TokenParams {
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: string;
}

export interface TokenCreationResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

export const useL2TokenFactory = () => {
  const { address, chainId } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateL2TokenParams | null>(null);
  const [tokenCountBeforeCreate, setTokenCountBeforeCreate] = useState<number | null>(null);

  const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isWaitingForReceipt, data: receipt } = useWaitForTransactionReceipt({
    hash: writeData,
    confirmations: 1,
  });

  // Read all tokens from factory
  const { data: allTokens, refetch: refetchTokens } = useReadContract({
    address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
    abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
  });

  // Monitor write pending state
  useEffect(() => {
    if (isWritePending) {
      setIsLoading(true);
    }
  }, [isWritePending]);

  // Monitor write error
  useEffect(() => {
    if (writeError) {
      setError(writeError.message || 'Transaction failed');
      setIsLoading(false);
    }
  }, [writeError]);

  // Monitor receipt and get token address from getAllTokens
  useEffect(() => {
    if (!receipt || !currentParams || tokenCountBeforeCreate === null) return;

    const extractTokenAddress = async () => {
      try {
        console.log('L2: Transaction confirmed, fetching all tokens...');
        
        // Refetch tokens after transaction is confirmed
        const result = await refetchTokens();
        const tokens = result.data as `0x${string}`[] | undefined;
        
        console.log('L2: All tokens from factory:', tokens);
        console.log('L2: Token count before create:', tokenCountBeforeCreate);
        
        if (tokens && tokens.length > tokenCountBeforeCreate) {
          // Get the last token (the one we just created)
          const newTokenAddress = tokens[tokens.length - 1];
          console.log('L2: New token address:', newTokenAddress);
          setTokenAddress(getAddress(newTokenAddress));
        } else {
          console.log('L2: No new token found');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('L2: Error fetching tokens:', err);
        setError(err instanceof Error ? err.message : 'Failed to get token address');
        setIsLoading(false);
      }
    };

    extractTokenAddress();
  }, [receipt, currentParams, tokenCountBeforeCreate, refetchTokens]);

  const createToken = useCallback(
    async (params: CreateL2TokenParams): Promise<TokenCreationResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      // Validate chain - must be on Celo Sepolia for L2 tokens
      if (chainId !== CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId) {
        const msg = `Please switch to Celo Sepolia network (Chain ID: ${CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId}). You are on chain ${chainId}.`;
        setError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setTokenAddress(null);
      setCurrentParams(params);
      
      // Store current token count before creating
      const currentCount = (allTokens as `0x${string}`[] | undefined)?.length || 0;
      setTokenCountBeforeCreate(currentCount);
      console.log('L2: Current token count before create:', currentCount);

      try {
        const maxSupplyBigInt = parseUnits(params.maxSupply, params.decimals);
        
        // Generate a unique salt for CREATE2 deployment
        const salt = toHex(`${params.name}-${params.symbol}-${Date.now()}`);

        // Send transaction
        writeContract({
          address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
          abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            getAddress(address),
            params.name,
            params.symbol,
            params.decimals as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18,
            maxSupplyBigInt,
            salt,
          ],
        });

        // Wait for the write to complete and transaction hash to be available
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create token';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, chainId, writeContract, allTokens]
  );

  const getResult = useCallback((): TokenCreationResult | null => {
    if (isLoading) return null;

    if (tokenAddress) {
      return {
        success: true,
        tokenAddress,
        txHash: writeData || undefined,
      };
    }

    if (error) {
      return {
        success: false,
        error,
        txHash: writeData || undefined,
      };
    }

    return null;
  }, [isLoading, tokenAddress, error, writeData]);

  return {
    createToken,
    isLoading: isLoading || isWritePending || isWaitingForReceipt,
    error,
    txHash: writeData || txHash,
    tokenAddress,
    isConnected: !!address,
    isCorrectChain: chainId === CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    getResult,
  };
};
