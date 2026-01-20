import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { parseUnits, getAddress, toHex } from 'viem';
import { CONTRACTS, L2_SUPERCHAIN_TOKEN_FACTORY_ABI } from '@/config/contracts';

export interface DeployHighVelocityTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: string;
}

export interface TokenDeploymentResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

export const useHighVelocityTokenDeploy = () => {
  const { address, chainId } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<DeployHighVelocityTokenParams | null>(null);
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
        console.log('HighVelocity: Transaction confirmed, fetching all tokens...');

        // Refetch tokens after transaction is confirmed
        const result = await refetchTokens();
        const tokens = result.data as `0x${string}`[] | undefined;

        console.log('HighVelocity: All tokens from factory:', tokens);
        console.log('HighVelocity: Token count before create:', tokenCountBeforeCreate);

        if (tokens && tokens.length > tokenCountBeforeCreate) {
          // Get the last token (the one we just created)
          const newTokenAddress = tokens[tokens.length - 1];
          console.log('HighVelocity: New token address:', newTokenAddress);
          setTokenAddress(getAddress(newTokenAddress));
        } else {
          console.log('HighVelocity: No new token found');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('HighVelocity: Error fetching tokens:', err);
        setError(err instanceof Error ? err.message : 'Failed to get token address');
        setIsLoading(false);
      }
    };

    extractTokenAddress();
  }, [receipt, currentParams, tokenCountBeforeCreate, refetchTokens]);

  const deployToken = useCallback(
    async (params: DeployHighVelocityTokenParams): Promise<TokenDeploymentResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      // Validate chain - must be on Celo Sepolia for HighVelocity tokens
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
      console.log('HighVelocity: Current token count before deploy:', currentCount);

      try {
        // Convert maxSupply to integer to avoid decimal issues with BigInt
        const maxSupplyInt = Math.floor(parseFloat(params.maxSupply));
        if (isNaN(maxSupplyInt) || maxSupplyInt <= 0) {
          throw new Error('Invalid max supply value');
        }
        const maxSupplyBigInt = parseUnits(maxSupplyInt.toString(), params.decimals);
        
        // Generate a deterministic salt from timestamp (integer only)
        const salt = toHex(Math.floor(Date.now()));

        // Deploy HighVelocity token (no bridge, no remoteToken)
        writeContract({
          address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
          abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            getAddress(address), // owner
            params.name,
            params.symbol,
            params.decimals,
            maxSupplyBigInt,
            salt, // salt for deterministic deployment
          ],
        });

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to deploy token';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, chainId, writeContract, allTokens]
  );

  const getResult = useCallback((): TokenDeploymentResult | null => {
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
    deployToken,
    isLoading: isLoading || isWritePending || isWaitingForReceipt,
    error,
    txHash: writeData || txHash,
    tokenAddress,
    isConnected: !!address,
    isCorrectChain: chainId === CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    getResult,
  };
};
