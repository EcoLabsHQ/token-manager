import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useState, useCallback, useEffect, useRef } from 'react';
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
  const publicClient = usePublicClient({ chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateL2TokenParams | null>(null);
  const [tokenCountBeforeCreate, setTokenCountBeforeCreate] = useState<number | null>(null);
  const isWaitingForReceipt = useRef(false);

  const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract();

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

  // Wait for transaction receipt using viem's waitForTransactionReceipt
  useEffect(() => {
    if (!writeData || !publicClient || !currentParams || tokenCountBeforeCreate === null) return;
    if (isWaitingForReceipt.current) return; // Prevent duplicate calls
    
    isWaitingForReceipt.current = true;
    setTxHash(writeData);

    const waitForReceipt = async () => {
      try {
        console.log('L2: Waiting for transaction receipt...', writeData);
        
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: writeData,
          confirmations: 1,
          timeout: 120_000, // 2 minute timeout
        });
        
        console.log('L2: Transaction confirmed!', receipt);
        
        if (receipt.status === 'reverted') {
          setError('Transaction reverted');
          setIsLoading(false);
          isWaitingForReceipt.current = false;
          return;
        }

        // Refetch tokens after transaction is confirmed
        console.log('L2: Transaction confirmed, fetching all tokens...');
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
          console.log('L2: No new token found, retrying...');
          // Retry once more after a delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryResult = await refetchTokens();
          const retryTokens = retryResult.data as `0x${string}`[] | undefined;
          if (retryTokens && retryTokens.length > tokenCountBeforeCreate) {
            const newTokenAddress = retryTokens[retryTokens.length - 1];
            console.log('L2: New token address (retry):', newTokenAddress);
            setTokenAddress(getAddress(newTokenAddress));
          }
        }

        setIsLoading(false);
        isWaitingForReceipt.current = false;
      } catch (err) {
        console.error('L2: Error waiting for receipt:', err);
        setError(err instanceof Error ? err.message : 'Failed to confirm transaction');
        setIsLoading(false);
        isWaitingForReceipt.current = false;
      }
    };

    waitForReceipt();
  }, [writeData, publicClient, currentParams, tokenCountBeforeCreate, refetchTokens]);

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
    isLoading: isLoading || isWritePending,
    error,
    txHash: writeData || txHash,
    tokenAddress,
    isConnected: !!address,
    isCorrectChain: chainId === CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    getResult,
  };
};
