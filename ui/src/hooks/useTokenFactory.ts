import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { parseUnits, getAddress, isAddress } from 'viem';

const FACTORY_ADDRESS = '0xf5167Df68E99c375dED2Dd48949b6BC9f891848D';

const FACTORY_ABI = [
  {
    name: 'createToken',
    type: 'function',
    inputs: [
      { name: 'owner_', type: 'address' },
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'decimals_', type: 'uint8' },
      { name: 'maxSupply_', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'decimals', type: 'uint8' },
      { name: 'maxSupply', type: 'uint256' },
    ],
  },
] as const;

export interface CreateTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
}

export interface TokenCreationResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

export const useTokenFactory = () => {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CreateTokenParams | null>(null);

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
            // Check if this is the TokenCreated event (first topic is event signature)
            // We'll just check if we have indexed topics since we can't easily compute the event signature
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
    async (params: CreateTokenParams): Promise<TokenCreationResult> => {
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
        const maxSupplyBigInt = parseUnits(params.maxSupply, params.decimals);

        // Send transaction
        writeContract({
          address: getAddress(FACTORY_ADDRESS),
          abi: FACTORY_ABI,
          functionName: 'createToken',
          args: [
            getAddress(address),
            params.name,
            params.symbol,
            params.decimals as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18,
            maxSupplyBigInt,
          ],
        });

        // Wait for the write to complete and transaction hash to be available
        // This is handled by the useEffect hooks above
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create token';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, writeContract]
  );

  // Provide a way to get the final result after the transaction is confirmed
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
    getResult,
  };
};
