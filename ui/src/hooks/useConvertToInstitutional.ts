import { useCallback, useState, useEffect } from 'react';
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
} from 'wagmi';
import { getAddress, parseUnits } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import {
  L1_TOKEN_FACTORY_ABI,
  L2_SUPERCHAIN_TOKEN_ABI,
} from '@/config/contracts';

export interface ConvertToInstitutionalParams {
  l2TokenAddress: string;
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
  bridgeAddress?: string;
}

export interface ConvertResult {
  success: boolean;
  step?: string;
  error?: string;
}

export const useConvertToInstitutional = () => {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [l1TxHash, setL1TxHash] = useState<`0x${string}` | null>(null);
  const [configTxHash, setConfigTxHash] = useState<`0x${string}` | null>(null);
  const [l1TokenAddress, setL1TokenAddress] = useState<`0x${string}` | null>(null);
  const [currentStep, setCurrentStep] = useState<'idle' | 'creating_l1' | 'configuring_bridge' | 'success' | 'error'>('idle');
  const [currentParams, setCurrentParams] = useState<ConvertToInstitutionalParams | null>(null);

  // Write contracts
  const { writeContract: writeL1Contract, data: writeL1Data } = useWriteContract();
  const { writeContract: writeConfigContract, data: writeConfigData } = useWriteContract();

  // Monitor writeL1Data - capture tx hash when sent
  useEffect(() => {
    if (writeL1Data && !l1TxHash && currentStep === 'creating_l1') {
      console.log('Convert: L1 tx sent:', writeL1Data);
      setL1TxHash(writeL1Data);
    }
  }, [writeL1Data, l1TxHash, currentStep]);

  // Monitor writeConfigData - capture tx hash when sent
  useEffect(() => {
    if (writeConfigData && !configTxHash && currentStep === 'configuring_bridge') {
      console.log('Convert: Config tx sent:', writeConfigData);
      setConfigTxHash(writeConfigData);
    }
  }, [writeConfigData, configTxHash, currentStep]);

  // Wait for L1 transaction
  const { data: l1Receipt, isLoading: isL1Pending } = useWaitForTransactionReceipt({
    hash: l1TxHash || undefined,
    confirmations: 1,
  });

  // Wait for config transaction
  const { data: configReceipt, isLoading: isConfigPending } = useWaitForTransactionReceipt({
    hash: configTxHash || undefined,
    confirmations: 1,
  });

  // Query L1 tokens to get the new token address
  const { refetch: refetchL1Tokens } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  } as any);

  // Monitor L1 receipt - advance to bridge config step when confirmed
  useEffect(() => {
    if (!l1Receipt || currentStep !== 'creating_l1') return;

    const extractL1Token = async () => {
      try {
        console.log('Convert: L1 confirmed, fetching token addresses...');
        const result = await refetchL1Tokens();
        const tokens = result.data as `0x${string}`[] | undefined;

        if (tokens && tokens.length > 0) {
          const newToken = tokens[tokens.length - 1];
          console.log('Convert: L1 token created:', newToken);
          setL1TokenAddress(getAddress(newToken));
          
          // Move to bridge configuration step
          setCurrentStep('configuring_bridge');
        } else {
          throw new Error('No token address found from L1 factory');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get L1 token address';
        console.error('Convert: L1 error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    extractL1Token();
  }, [l1Receipt, currentStep, refetchL1Tokens]);

  // Monitor config receipt - mark as success when confirmed
  useEffect(() => {
    if (!configReceipt || currentStep !== 'configuring_bridge') return;

    console.log('Convert: Bridge configured successfully');
    setCurrentStep('success');
    setIsLoading(false);
  }, [configReceipt, currentStep]);

  // Main function to start conversion
  const convertToInstitutional = useCallback(
    async (params: ConvertToInstitutionalParams): Promise<ConvertResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      // Validate L2 token address
      if (!params.l2TokenAddress || !params.l2TokenAddress.startsWith('0x')) {
        const msg = 'Invalid L2 token address';
        setError(msg);
        return { success: false, error: msg };
      }

      // Reset state
      setIsLoading(true);
      setError(null);
      setL1TxHash(null);
      setConfigTxHash(null);
      setL1TokenAddress(null);
      setCurrentParams(params);
      setCurrentStep('creating_l1');

      try {
        // Ensure we're on L1 (Sepolia) for creating the L1 token
        const l1ChainId = CONTRACTS.L1_TOKEN_FACTORY.chainId;
        if (chainId !== l1ChainId) {
          console.log('Convert: Switching to Sepolia (L1)...');
          await switchChainAsync({ chainId: l1ChainId });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('Convert: Creating L1 token...');
        const initialSupplyInt = parseInt(params.initialSupply, 10);
        if (isNaN(initialSupplyInt) || initialSupplyInt <= 0) {
          throw new Error('Invalid initial supply');
        }
        const l1InitialSupplyBigInt = parseUnits(initialSupplyInt.toString(), params.decimals);
        
        const maxSupplyInt = parseInt(params.maxSupply, 10);
        if (isNaN(maxSupplyInt) || maxSupplyInt <= 0) {
          throw new Error('Invalid max supply');
        }
        const l1MaxSupplyBigInt = parseUnits(maxSupplyInt.toString(), params.decimals);

        writeL1Contract({
          address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
          abi: L1_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            params.name,
            params.symbol,
            l1InitialSupplyBigInt,
            l1MaxSupplyBigInt,
            params.decimals,
            getAddress(address),
          ],
        });

        return { success: true, step: 'L1 deployment started' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start conversion';
        setError(errorMessage);
        setIsLoading(false);
        setCurrentStep('error');
        return { success: false, error: errorMessage };
      }
    },
    [address, chainId, switchChainAsync, writeL1Contract]
  );

  // Auto-trigger bridge configuration when L1 is created
  useEffect(() => {
    if (currentStep !== 'configuring_bridge' || !currentParams || !l1TokenAddress) return;

    const configureBridge = async () => {
      try {
        console.log('Convert: Configuring bridge on L2 token...');
        
        // Switch to L2 (Celo Sepolia) for configuring the L2 token
        const l2ChainId = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
        if (chainId !== l2ChainId) {
          console.log('Convert: Switching to Celo Sepolia (L2)...');
          await switchChainAsync({ chainId: l2ChainId });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Set the remote token on the existing L2 token
        writeConfigContract({
          address: getAddress(currentParams.l2TokenAddress),
          abi: L2_SUPERCHAIN_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(l1TokenAddress)],
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to configure bridge';
        console.error('Convert: Bridge config error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    configureBridge();
  }, [currentStep, currentParams, l1TokenAddress, chainId, switchChainAsync, writeConfigContract]);

  return {
    convertToInstitutional,
    isLoading: isLoading || isL1Pending || isConfigPending,
    error,
    l1TokenAddress,
    l2TokenAddress: currentParams?.l2TokenAddress || null,
    currentStep,
  };
};
