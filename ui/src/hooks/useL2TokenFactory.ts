import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useState, useCallback, useEffect, useRef } from 'react';
import { parseUnits, getAddress, toHex } from 'viem';
import { CONTRACTS, L2_SUPERCHAIN_TOKEN_FACTORY_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface CreateL2TokenParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
}

export interface MintInitialSupplyParams {
  tokenAddress: string;
  to: string;
  amount: string;
  decimals: number;
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
  
  // Mint state
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | null>(null);
  const [mintComplete, setMintComplete] = useState(false);
  const isMintWaitingForReceipt = useRef(false);

  const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract();
  const { writeContract: writeMintContract, data: mintWriteData, isPending: isMintWritePending, error: mintWriteError } = useWriteContract();

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

  // Monitor mint write pending state
  useEffect(() => {
    if (isMintWritePending) {
      setIsMinting(true);
    }
  }, [isMintWritePending]);

  // Monitor mint write error
  useEffect(() => {
    if (mintWriteError) {
      setMintError(mintWriteError.message || 'Mint transaction failed');
      setIsMinting(false);
    }
  }, [mintWriteError]);

  // Wait for mint transaction receipt
  useEffect(() => {
    if (!mintWriteData || !publicClient) return;
    if (isMintWaitingForReceipt.current) return;
    
    isMintWaitingForReceipt.current = true;
    setMintTxHash(mintWriteData);

    const waitForMintReceipt = async () => {
      try {
        console.log('L2: Waiting for mint transaction receipt...', mintWriteData);
        
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: mintWriteData,
          confirmations: 1,
          timeout: 120_000,
        });
        
        console.log('L2: Mint transaction confirmed!', receipt);
        
        if (receipt.status === 'reverted') {
          setMintError('Mint transaction reverted');
          setIsMinting(false);
          isMintWaitingForReceipt.current = false;
          return;
        }

        setMintComplete(true);
        setIsMinting(false);
        isMintWaitingForReceipt.current = false;
      } catch (err) {
        console.error('L2: Error waiting for mint receipt:', err);
        setMintError(err instanceof Error ? err.message : 'Failed to confirm mint transaction');
        setIsMinting(false);
        isMintWaitingForReceipt.current = false;
      }
    };

    waitForMintReceipt();
  }, [mintWriteData, publicClient]);

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

      // Note: Chain validation is handled by useCreateToken which does auto-switch

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
        const initialSupplyBigInt = parseUnits(params.initialSupply, params.decimals);
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
            initialSupplyBigInt,
            maxSupplyBigInt,
            salt,
          ],
          chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
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

  const mintInitialSupply = useCallback(
    async (params: MintInitialSupplyParams): Promise<TokenCreationResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setMintError(msg);
        return { success: false, error: msg };
      }

      // Note: Chain validation is handled by useCreateToken which does auto-switch

      setIsMinting(true);
      setMintError(null);
      setMintTxHash(null);
      setMintComplete(false);

      try {
        const amountBigInt = parseUnits(params.amount, params.decimals);

        console.log('L2: Minting initial supply...', {
          tokenAddress: params.tokenAddress,
          to: params.to,
          amount: amountBigInt.toString(),
        });

        writeMintContract({
          address: getAddress(params.tokenAddress),
          abi: L2_SUPERCHAIN_TOKEN_ABI,
          functionName: 'mint',
          args: [getAddress(params.to), amountBigInt],
          chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
        });

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to mint initial supply';
        setMintError(errorMessage);
        setIsMinting(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, chainId, writeMintContract]
  );

  const getMintResult = useCallback((): TokenCreationResult | null => {
    if (isMinting) return null;

    if (mintComplete) {
      return {
        success: true,
        txHash: mintTxHash || undefined,
      };
    }

    if (mintError) {
      return {
        success: false,
        error: mintError,
        txHash: mintTxHash || undefined,
      };
    }

    return null;
  }, [isMinting, mintComplete, mintError, mintTxHash]);

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

  const resetMintState = useCallback(() => {
    setIsMinting(false);
    setMintError(null);
    setMintTxHash(null);
    setMintComplete(false);
    isMintWaitingForReceipt.current = false;
  }, []);

  return {
    createToken,
    mintInitialSupply,
    isLoading: isLoading || isWritePending,
    isMinting: isMinting || isMintWritePending,
    error,
    mintError,
    txHash: writeData || txHash,
    mintTxHash,
    tokenAddress,
    userAddress: address,
    isConnected: !!address,
    isCorrectChain: chainId === CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    getResult,
    getMintResult,
    resetMintState,
  };
};
