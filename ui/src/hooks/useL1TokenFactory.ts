import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useState, useCallback, useEffect, useRef } from 'react';
import { parseUnits, getAddress } from 'viem';
import { CONTRACTS, L1_TOKEN_FACTORY_ABI } from '@/config/contracts';

export interface CreateL1TokenParams {
  name: string;
  symbol: string;
  initialSupply: string;
}

export interface TokenCreationResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

export const useL1TokenFactory = () => {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateL1TokenParams | null>(null);
  const [tokenCountBeforeCreate, setTokenCountBeforeCreate] = useState<number | null>(null);
  const isWaitingForReceipt = useRef(false);

  const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract();

  // Read all tokens from factory
  const { data: allTokens, refetch: refetchTokens } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
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
        console.log('L1: Waiting for transaction receipt...', writeData);
        
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: writeData,
          confirmations: 1,
          timeout: 120_000, // 2 minute timeout
        });
        
        console.log('L1: Transaction confirmed!', receipt);
        
        if (receipt.status === 'reverted') {
          setError('Transaction reverted');
          setIsLoading(false);
          isWaitingForReceipt.current = false;
          return;
        }

        // Refetch tokens after transaction is confirmed
        console.log('L1: Transaction confirmed, fetching all tokens...');
        const result = await refetchTokens();
        const tokens = result.data as `0x${string}`[] | undefined;
        
        console.log('L1: All tokens from factory:', tokens);
        console.log('L1: Token count before create:', tokenCountBeforeCreate);
        
        if (tokens && tokens.length > tokenCountBeforeCreate) {
          // Get the last token (the one we just created)
          const newTokenAddress = tokens[tokens.length - 1];
          console.log('L1: New token address:', newTokenAddress);
          setTokenAddress(getAddress(newTokenAddress));
        } else {
          console.log('L1: No new token found, retrying...');
          // Retry once more after a delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryResult = await refetchTokens();
          const retryTokens = retryResult.data as `0x${string}`[] | undefined;
          if (retryTokens && retryTokens.length > tokenCountBeforeCreate) {
            const newTokenAddress = retryTokens[retryTokens.length - 1];
            console.log('L1: New token address (retry):', newTokenAddress);
            setTokenAddress(getAddress(newTokenAddress));
          }
        }

        setIsLoading(false);
        isWaitingForReceipt.current = false;
      } catch (err) {
        console.error('L1: Error waiting for receipt:', err);
        setError(err instanceof Error ? err.message : 'Failed to confirm transaction');
        setIsLoading(false);
        isWaitingForReceipt.current = false;
      }
    };

    waitForReceipt();
  }, [writeData, publicClient, currentParams, tokenCountBeforeCreate, refetchTokens]);

  const createToken = useCallback(
    async (params: CreateL1TokenParams): Promise<TokenCreationResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      // Validate chain - must be on Sepolia for L1 tokens
      if (chainId !== CONTRACTS.L1_TOKEN_FACTORY.chainId) {
        const msg = `Please switch to Sepolia network (Chain ID: ${CONTRACTS.L1_TOKEN_FACTORY.chainId}). You are on chain ${chainId}.`;
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
      console.log('L1: Current token count before create:', currentCount);

      try {
        // L1 tokens typically use 18 decimals
        const initialSupplyBigInt = parseUnits(params.initialSupply, 18);

        // Send transaction
        writeContract({
          address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
          abi: L1_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            params.name,
            params.symbol,
            initialSupplyBigInt,
            getAddress(address),
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
    isCorrectChain: chainId === CONTRACTS.L1_TOKEN_FACTORY.chainId,
    getResult,
  };
};
