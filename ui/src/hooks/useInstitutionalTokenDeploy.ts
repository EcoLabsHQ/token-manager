import { useCallback, useState, useEffect } from 'react';
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
} from 'wagmi';
import { getAddress, parseUnits, toHex } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import {
  L1_TOKEN_FACTORY_ABI,
  L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
  L2_SUPERCHAIN_TOKEN_ABI,
} from '@/config/contracts';

export interface InstitutionalTokenParams {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
  bridgeAddress?: string;
}

export interface InstitutionalTokenDeploymentResult {
  success: boolean;
  step?: string;
  error?: string;
}

export const useInstitutionalTokenDeploy = () => {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [l1TxHash, setL1TxHash] = useState<`0x${string}` | null>(null);
  const [l2TxHash, setL2TxHash] = useState<`0x${string}` | null>(null);
  const [l1TokenAddress, setL1TokenAddress] = useState<`0x${string}` | null>(null);
  const [l2TokenAddress, setL2TokenAddress] = useState<`0x${string}` | null>(null);
  const [currentStep, setCurrentStep] = useState<'idle' | 'creating_l1' | 'creating_l2' | 'configuring' | 'success' | 'error'>('idle');
  const [currentParams, setCurrentParams] = useState<InstitutionalTokenParams | null>(null);

  // Write contracts
  const { writeContract: writeL1Contract, data: writeL1Data } = useWriteContract();
  const { writeContract: writeL2Contract, data: writeL2Data } = useWriteContract();
  const { writeContract: writeConfigContract } = useWriteContract();

  // Monitor writeL1Data - capture tx hash when sent
  useEffect(() => {
    if (writeL1Data && !l1TxHash && currentStep === 'creating_l1') {
      console.log('L1 tx sent:', writeL1Data);
      setL1TxHash(writeL1Data);
    }
  }, [writeL1Data, l1TxHash, currentStep]);

  // Monitor writeL2Data - capture tx hash when sent
  useEffect(() => {
    if (writeL2Data && !l2TxHash && currentStep === 'creating_l2') {
      console.log('L2 tx sent:', writeL2Data);
      setL2TxHash(writeL2Data);
    }
  }, [writeL2Data, l2TxHash, currentStep]);

  // Wait for L1 transaction
  const { data: l1Receipt, isLoading: isL1Pending } = useWaitForTransactionReceipt({
    hash: l1TxHash || undefined,
    confirmations: 1,
  });

  // Wait for L2 transaction
  const { data: l2Receipt, isLoading: isL2Pending } = useWaitForTransactionReceipt({
    hash: l2TxHash || undefined,
    confirmations: 1,
  });

  // Query L1 tokens
  const { refetch: refetchL1Tokens } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  } as any);

  // Query L2 tokens
  const { refetch: refetchL2Tokens } = useReadContract({
    address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
    abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
    functionName: 'getAllTokens',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
  } as any);

  // Monitor L1 receipt - advance to L2 step when confirmed
  useEffect(() => {
    if (!l1Receipt || currentStep !== 'creating_l1') return;

    const extractL1Token = async () => {
      try {
        console.log('L1 confirmed, fetching token addresses...');
        const result = await refetchL1Tokens();
        const tokens = result.data as `0x${string}`[] | undefined;

        if (tokens && tokens.length > 0) {
          const newToken = tokens[tokens.length - 1];
          console.log('L1 token created:', newToken);
          setL1TokenAddress(getAddress(newToken));
          
          // Move to L2 step
          setCurrentStep('creating_l2');
        } else {
          throw new Error('No token address found from L1 factory');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get L1 token address';
        console.error('L1 error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    extractL1Token();
  }, [l1Receipt, currentStep, refetchL1Tokens]);

  // Monitor L2 receipt - advance to configuration step
  useEffect(() => {
    if (!l2Receipt || currentStep !== 'creating_l2') return;

    const extractL2Token = async () => {
      try {
        console.log('L2 confirmed, fetching token addresses...');
        const result = await refetchL2Tokens();
        const tokens = result.data as `0x${string}`[] | undefined;

        if (tokens && tokens.length > 0) {
          const newToken = tokens[tokens.length - 1];
          console.log('L2 token created:', newToken);
          setL2TokenAddress(getAddress(newToken));
          
          // Move to configuration
          setCurrentStep('configuring');
        } else {
          throw new Error('No token address found from L2 factory');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get L2 token address';
        console.error('L2 error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    extractL2Token();
  }, [l2Receipt, currentStep, refetchL2Tokens]);

  const deployInstitutionalToken = useCallback(
    async (params: InstitutionalTokenParams): Promise<InstitutionalTokenDeploymentResult> => {
      if (!address) {
        const msg = 'Wallet not connected';
        setError(msg);
        return { success: false, error: msg };
      }

      // Reset state
      setIsLoading(true);
      setError(null);
      setL1TxHash(null);
      setL2TxHash(null);
      setL1TokenAddress(null);
      setL2TokenAddress(null);
      setCurrentParams(params);
      setCurrentStep('creating_l1');

      try {
        console.log('Starting L1 token deployment...');
        
        // Switch to Sepolia (L1) if not already there
        const l1ChainId = CONTRACTS.L1_TOKEN_FACTORY.chainId;
        if (chainId !== l1ChainId) {
          console.log('Switching to Sepolia (L1)...');
          await switchChainAsync({ chainId: l1ChainId });
          // Wait a bit for chain switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Convert to integer to avoid decimal issues
        const initialSupplyNum = parseInt(params.initialSupply, 10);
        if (isNaN(initialSupplyNum) || initialSupplyNum <= 0) {
          throw new Error('Invalid initial supply value');
        }
        const l1InitialSupplyBigInt = parseUnits(initialSupplyNum.toString(), 18);

        writeL1Contract({
          address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
          abi: L1_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            params.name,
            params.symbol,
            l1InitialSupplyBigInt,
            getAddress(address),
          ],
        });

        return { success: true, step: 'L1 deployment started' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to deploy';
        setError(errorMessage);
        setIsLoading(false);
        setCurrentStep('error');
        return { success: false, error: errorMessage };
      }
    },
    [address, writeL1Contract, chainId, switchChainAsync]
  );

  // Auto-trigger L2 deployment when L1 is done
  useEffect(() => {
    if (currentStep !== 'creating_l2' || !currentParams || !l1TokenAddress) return;

    const deployL2 = async () => {
      try {
        console.log('Starting L2 token deployment...');
        
        // Switch to Celo Sepolia (L2) if not already there
        const l2ChainId = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
        if (chainId !== l2ChainId) {
          console.log('Switching to Celo Sepolia (L2)...');
          await switchChainAsync({ chainId: l2ChainId });
          // Wait a bit for chain switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Convert to integer and validate
        const maxSupplyNum = parseInt(currentParams.maxSupply, 10);
        if (isNaN(maxSupplyNum) || maxSupplyNum <= 0) {
          throw new Error('Invalid max supply value');
        }
        
        const maxSupplyBigInt = parseUnits(maxSupplyNum.toString(), currentParams.decimals);
        // Generate salt from integer timestamp only
        const salt = toHex(Math.floor(Date.now()));

        writeL2Contract({
          address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
          abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            getAddress(address!),
            currentParams.name,
            currentParams.symbol,
            currentParams.decimals,
            maxSupplyBigInt,
            salt,
          ],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to deploy L2';
        console.error('L2 deployment error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    deployL2();
  }, [currentStep, currentParams, l1TokenAddress, address, chainId, switchChainAsync, writeL2Contract]);

  // Auto-trigger bridge configuration when L2 is done
  useEffect(() => {
    if (currentStep !== 'configuring' || !l1TokenAddress || !l2TokenAddress) return;

    const configureBridge = async () => {
      try {
        console.log('Configuring bridge connections...');
        
        // Ensure we're on L2 (Celo Sepolia) for setting remote token
        const l2ChainId = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
        if (chainId !== l2ChainId) {
          console.log('Switching to Celo Sepolia (L2) for bridge config...');
          await switchChainAsync({ chainId: l2ChainId });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        writeConfigContract({
          address: getAddress(l2TokenAddress),
          abi: L2_SUPERCHAIN_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(l1TokenAddress)],
        });

        // Mark as success after config is initiated
        setTimeout(() => {
          setCurrentStep('success');
          setIsLoading(false);
        }, 1000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to configure bridge';
        console.error('Bridge config error:', msg);
        setError(msg);
        setCurrentStep('error');
      }
    };

    configureBridge();
  }, [currentStep, l1TokenAddress, l2TokenAddress, chainId, switchChainAsync, writeConfigContract]);

  return {
    deployInstitutionalToken,
    isLoading: isLoading || isL1Pending || isL2Pending,
    error,
    l1TokenAddress,
    l2TokenAddress,
    currentStep,
  };
};
