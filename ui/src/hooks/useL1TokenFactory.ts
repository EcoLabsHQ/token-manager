import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { parseUnits, getAddress, isAddress } from 'viem';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateL1TokenParams | null>(null);

  const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isWaitingForReceipt, data: receipt } = useWaitForTransactionReceipt({
    hash: writeData,
    confirmations: 1,
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

  // Monitor receipt and extract token address
  useEffect(() => {
    if (!receipt || !currentParams) return;

    const extractTokenAddress = async () => {
      try {
        // Extract token address from event logs
        let foundTokenAddress: string | null = null;

        for (const log of receipt.logs || []) {
          try {
            // Check if this is the TokenCreated event
            if (log.topics && log.topics.length > 0) {
              // The token address is typically in the first indexed parameter (topics[1])
              if (log.topics[1]) {
                const extractedAddress = '0x' + log.topics[1].slice(-40);
                if (isAddress(extractedAddress)) {
                  foundTokenAddress = getAddress(extractedAddress);
                  break;
                }
              }
            }
          } catch (e) {
            continue;
          }
        }

        if (foundTokenAddress) {
          setTokenAddress(foundTokenAddress);
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to extract token address');
        setIsLoading(false);
      }
    };

    extractTokenAddress();
  }, [receipt, currentParams]);

  const createToken = useCallback(
    async (params: CreateL1TokenParams): Promise<TokenCreationResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setTokenAddress(null);
      setCurrentParams(params);

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
    [address, chainId, writeContract]
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
    isCorrectChain: chainId === CONTRACTS.L1_TOKEN_FACTORY.chainId,
    getResult,
  };
};
