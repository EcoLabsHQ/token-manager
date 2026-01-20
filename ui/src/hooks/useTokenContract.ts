import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, getAddress, isAddress } from 'viem';
import { L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_ABI, CONTRACTS } from '@/config/contracts';

// Interface para el estado del contrato
export interface TokenContractState {
  totalSupply: string;
  maxSupply: string;
  paused: boolean;
  owner: string;
  decimals: number;
  name: string;
  symbol: string;
  userBalance: string;
}

// Determinar qué ABI usar basado en el chain ID
const getTokenABI = (chainId: number | undefined) => {
  // Sepolia (L1) = 11155111
  // Celo L2 Sepolia = 11142220
  return chainId === CONTRACTS.L1_TOKEN_FACTORY.chainId ? L1_TOKEN_ABI : L2_SUPERCHAIN_TOKEN_ABI;
};

// Hook personalizado para interactuar con el contrato
export const useTokenContract = (contractAddress: string) => {
  const { address, chainId } = useAccount();
  const [state, setState] = useState<TokenContractState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenABI = getTokenABI(chainId);
  
  // Validar que la dirección sea válida
  const isValidAddress = contractAddress && 
    contractAddress !== '0x0000000000000000000000000000000000000000' &&
    isAddress(contractAddress);
  
  const validAddress = isValidAddress ? getAddress(contractAddress) : undefined;
  
  // Solo habilitar queries si hay una dirección válida
  const queryEnabled = !!validAddress && !!chainId;

  // Lecturas del contrato
  const { data: name, isLoading: isLoadingName, refetch: refetchName } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'name',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: symbol, isLoading: isLoadingSymbol, refetch: refetchSymbol } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'symbol',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: decimals, isLoading: isLoadingDecimals, refetch: refetchDecimals } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'decimals',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: totalSupply, isLoading: isLoadingTotalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'totalSupply',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: maxSupply, isLoading: isLoadingMaxSupply, refetch: refetchMaxSupply } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'maxSupply',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: owner, isLoading: isLoadingOwner, refetch: refetchOwner } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'owner',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: paused, isLoading: isLoadingPaused, refetch: refetchPaused } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'paused',
    query: {
      enabled: queryEnabled,
    },
  });

  const { data: userBalance, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
    address: validAddress,
    abi: tokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: queryEnabled && !!address,
    },
  });

  // Calcular loading basado en las queries individuales
  const isQueryLoading = isLoadingName || isLoadingSymbol || isLoadingDecimals || 
    isLoadingTotalSupply || isLoadingMaxSupply || isLoadingOwner || isLoadingPaused || isLoadingBalance;

  // Escrituras del contrato
  const { writeContract, data: writeData, isPending: isWritePending } = useWriteContract();
  const { isLoading: isWaitingForReceipt } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  // Actualizar estado cuando cambien los datos
  useEffect(() => {
    if (!queryEnabled) {
      setState(null);
      return;
    }
    
    if (name && symbol && decimals !== undefined && totalSupply !== undefined && maxSupply !== undefined && owner && paused !== undefined) {
      const dec = Number(decimals);
      setState({
        name: name as string,
        symbol: symbol as string,
        decimals: dec,
        totalSupply: formatUnits(totalSupply as bigint, dec),
        maxSupply: formatUnits(maxSupply as bigint, dec),
        owner: owner as string,
        paused: paused as boolean,
        userBalance: userBalance ? formatUnits(userBalance as bigint, dec) : '0',
      });
    }
  }, [name, symbol, decimals, totalSupply, maxSupply, owner, paused, userBalance, queryEnabled]);

  // Función para refrescar el estado del contrato
  const fetchContractState = useCallback(async () => {
    if (!queryEnabled) return;
    
    await Promise.all([
      refetchName(),
      refetchSymbol(),
      refetchDecimals(),
      refetchTotalSupply(),
      refetchMaxSupply(),
      refetchOwner(),
      refetchPaused(),
      refetchBalance(),
    ]);
  }, [queryEnabled, refetchName, refetchSymbol, refetchDecimals, refetchTotalSupply, refetchMaxSupply, refetchOwner, refetchPaused, refetchBalance]);

  // Función para acuñar tokens
  const mint = useCallback(async (to: string, amount: string) => {
    if (!validAddress || !address) {
      setError('Wallet not connected or invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const decimalsNum = state?.decimals || 18;
      // Ensure amount is a valid number string without decimals
      const amountInt = Math.floor(parseFloat(amount));
      if (isNaN(amountInt) || amountInt <= 0) {
        throw new Error('Invalid amount');
      }
      const amountBigInt = parseUnits(amountInt.toString(), decimalsNum);

      writeContract({
        address: validAddress,
        abi: tokenABI,
        functionName: 'mint',
        args: [getAddress(to), amountBigInt],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error minting tokens');
    } finally {
      setLoading(false);
    }
  }, [validAddress, address, state?.decimals, tokenABI, writeContract]);

  // Función para quemar tokens
  const burn = useCallback(async (amount: string) => {
    if (!validAddress || !address) {
      setError('Wallet not connected or invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const decimalsNum = state?.decimals || 18;
      // Ensure amount is a valid number string without decimals
      const amountInt = Math.floor(parseFloat(amount));
      if (isNaN(amountInt) || amountInt <= 0) {
        throw new Error('Invalid amount');
      }
      const amountBigInt = parseUnits(amountInt.toString(), decimalsNum);

      writeContract({
        address: validAddress,
        abi: tokenABI,
        functionName: 'burn',
        args: [address, amountBigInt],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error burning tokens');
    } finally {
      setLoading(false);
    }
  }, [validAddress, address, state?.decimals, tokenABI, writeContract]);

  // Función para transferir tokens
  const transfer = useCallback(async (to: string, amount: string) => {
    if (!validAddress || !address) {
      setError('Wallet not connected or invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const decimalsNum = state?.decimals || 18;
      const amountBigInt = parseUnits(amount, decimalsNum);

      writeContract({
        address: validAddress,
        abi: tokenABI,
        functionName: 'transfer',
        args: [getAddress(to), amountBigInt],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error transferring tokens');
    } finally {
      setLoading(false);
    }
  }, [validAddress, address, state?.decimals, tokenABI, writeContract]);

  // Función para pausar/reanudar el contrato
  const togglePause = useCallback(async (shouldPause: boolean) => {
    if (!validAddress || !address) {
      setError('Wallet not connected or invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      writeContract({
        address: validAddress,
        abi: tokenABI,
        functionName: shouldPause ? 'pause' : 'unpause',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error toggling pause');
    } finally {
      setLoading(false);
    }
  }, [validAddress, address, tokenABI, writeContract]);

  // Función para establecer el suministro máximo
  const setMaxSupply = useCallback(async (newMaxSupply: string) => {
    if (!validAddress || !address) {
      setError('Wallet not connected or invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const decimalsNum = state?.decimals || 18;
      const maxSupplyBigInt = parseUnits(newMaxSupply, decimalsNum);

      writeContract({
        address: validAddress,
        abi: tokenABI,
        functionName: 'setMaxSupply',
        args: [maxSupplyBigInt],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error setting max supply');
    } finally {
      setLoading(false);
    }
  }, [validAddress, address, state?.decimals, tokenABI, writeContract]);

  return {
    state,
    loading: loading || isWritePending || isWaitingForReceipt || isQueryLoading,
    error,
    fetchContractState,
    mint,
    burn,
    transfer,
    togglePause,
    setMaxSupply,
  };
};
