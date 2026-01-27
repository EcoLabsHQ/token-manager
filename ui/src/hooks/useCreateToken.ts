import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  tokenFormSchema, 
  defaultTokenFormValues,
  type TokenFormData, 
  type TokenType 
} from '../lib/schemas';
import { useTokenStorage } from './useTokenStorage';
import { useL1TokenFactory } from './useL1TokenFactory';
import { useL2TokenFactory } from './useL2TokenFactory';

export type CreateTokenStep = 'choose-type' | 'token-info' | 'review' | 'deploying' | 'success';

interface DeploymentResult {
  l1Address?: string;
  l2Address: string;
  txHash?: string;
}

interface FactoryState {
  isConnected: boolean;
  isCorrectChain: boolean;
  isLoading: boolean;
}

interface UseCreateTokenReturn {
  // Form
  form: ReturnType<typeof useForm<TokenFormData>>;
  
  // Token type
  tokenType: TokenType | null;
  setTokenType: (type: TokenType) => void;
  
  // Step management
  step: CreateTokenStep;
  setStep: (step: CreateTokenStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  
  // Deployment
  deployingStep: number;
  deploymentResult: DeploymentResult | null;
  isDeploying: boolean;
  deployError: string | null;
  startDeployment: () => Promise<void>;
  
  // Reset
  reset: () => void;
  
  // Factory states
  l1Factory: FactoryState;
  l2Factory: FactoryState;
}

export function useCreateToken(): UseCreateTokenReturn {
  const [tokenType, setTokenType] = useState<TokenType | null>(null);
  const [step, setStep] = useState<CreateTokenStep>('choose-type');
  const [deployingStep, setDeployingStep] = useState(0);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  
  const { addToken } = useTokenStorage();
  
  // Factory hooks
  const l1Factory = useL1TokenFactory();
  const l2Factory = useL2TokenFactory();

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: defaultTokenFormValues,
    mode: 'onChange',
  });

  // Monitor L1 factory completion for ethereum-enabled tokens
  useEffect(() => {
    if (tokenType !== 'ethereum-enabled' || !isDeploying) return;
    
    const l1Result = l1Factory.getResult();
    if (l1Result && l1Result.success && l1Result.tokenAddress && deployingStep === 1) {
      console.log('L1 token created:', l1Result.tokenAddress);
      // Move to L2 deployment
      setDeployingStep(2);
      
      const formData = form.getValues();
      // Start L2 deployment
      l2Factory.createToken({
        name: formData.name,
        symbol: formData.symbol,
        decimals: formData.decimals,
        maxSupply: formData.maxSupply,
      });
    } else if (l1Result && !l1Result.success && l1Result.error) {
      setDeployError(l1Result.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l1Factory, deployingStep, form, l2Factory]);

  // Monitor L2 factory completion
  useEffect(() => {
    if (!isDeploying) return;
    
    const l2Result = l2Factory.getResult();
    
    if (tokenType === 'celo-native' && l2Result && l2Result.success && l2Result.tokenAddress) {
      // Celo-native token created, now mint initial supply
      console.log('L2 token created (celo-native):', l2Result.tokenAddress);
      
      const formData = form.getValues();
      const initialSupply = formData.initialSupply;
      
      // Only mint if initialSupply > 0 and we haven't started minting yet
      if (Number(initialSupply) > 0 && deployingStep === 1 && l2Factory.userAddress) {
        console.log('Starting initial supply mint...');
        setDeployingStep(2); // Move to minting step
        
        l2Factory.mintInitialSupply({
          tokenAddress: l2Result.tokenAddress,
          to: l2Factory.userAddress,
          amount: initialSupply,
          decimals: formData.decimals,
        });
      } else if (Number(initialSupply) === 0) {
        // No initial supply to mint, complete immediately
        const result: DeploymentResult = {
          l2Address: l2Result.tokenAddress,
          txHash: l2Result.txHash,
        };
        
        setDeploymentResult(result);
        addToken({
          name: formData.name,
          symbol: formData.symbol,
          type: 'celo-native',
          maxSupply: Number(formData.maxSupply).toLocaleString(),
          addressL2: l2Result.tokenAddress,
        });
        
        setDeployingStep(2);
        setTimeout(() => setStep('success'), 1000);
        setIsDeploying(false);
      }
      
    } else if (tokenType === 'ethereum-enabled' && deployingStep === 2 && l2Result && l2Result.success && l2Result.tokenAddress) {
      // Ethereum-enabled: L2 token created, now mint initial supply
      console.log('L2 token created (ethereum-enabled):', l2Result.tokenAddress);
      
      const formData = form.getValues();
      const initialSupply = formData.initialSupply;
      
      // Only mint if initialSupply > 0 and we haven't started minting yet
      if (Number(initialSupply) > 0 && l2Factory.userAddress) {
        console.log('Starting initial supply mint (ethereum-enabled)...');
        setDeployingStep(3); // Move to minting step
        
        l2Factory.mintInitialSupply({
          tokenAddress: l2Result.tokenAddress,
          to: l2Factory.userAddress,
          amount: initialSupply,
          decimals: formData.decimals,
        });
      } else if (Number(initialSupply) === 0) {
        // No initial supply, skip to bridge config step
        setDeployingStep(3);
      }
      
    } else if (l2Result && !l2Result.success && l2Result.error) {
      setDeployError(l2Result.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l2Factory, deployingStep, form, addToken, l1Factory]);

  // Monitor mint completion
  useEffect(() => {
    if (!isDeploying) return;
    
    const mintResult = l2Factory.getMintResult();
    const l2Result = l2Factory.getResult();
    
    if (tokenType === 'celo-native' && deployingStep === 2 && mintResult && mintResult.success && l2Result?.tokenAddress) {
      // Celo-native: mint complete
      console.log('Initial supply minted (celo-native)');
      
      const formData = form.getValues();
      const result: DeploymentResult = {
        l2Address: l2Result.tokenAddress,
        txHash: l2Result.txHash,
      };
      
      setDeploymentResult(result);
      addToken({
        name: formData.name,
        symbol: formData.symbol,
        type: 'celo-native',
        maxSupply: Number(formData.maxSupply).toLocaleString(),
        addressL2: l2Result.tokenAddress,
      });
      
      setDeployingStep(3);
      setTimeout(() => setStep('success'), 1000);
      setIsDeploying(false);
      
    } else if (tokenType === 'ethereum-enabled' && deployingStep === 3 && mintResult && mintResult.success && l2Result?.tokenAddress) {
      // Ethereum-enabled: mint complete, now proceed to bridge config (step 4)
      console.log('Initial supply minted (ethereum-enabled)');
      setDeployingStep(4);
      
      // TODO: Add bridge configuration step here
      // For now, complete the deployment
      const l1Result = l1Factory.getResult();
      const formData = form.getValues();
      
      const result: DeploymentResult = {
        l1Address: l1Result?.tokenAddress,
        l2Address: l2Result.tokenAddress,
        txHash: l2Result.txHash,
      };
      
      setDeploymentResult(result);
      addToken({
        name: formData.name,
        symbol: formData.symbol,
        type: 'ethereum-enabled',
        maxSupply: Number(formData.maxSupply).toLocaleString(),
        addressL1: l1Result?.tokenAddress,
        addressL2: l2Result.tokenAddress,
      });
      
      setDeployingStep(5);
      setTimeout(() => setStep('success'), 1000);
      setIsDeploying(false);
      
    } else if (mintResult && !mintResult.success && mintResult.error) {
      setDeployError(mintResult.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l2Factory, deployingStep, form, addToken, l1Factory]);

  const goToNextStep = useCallback(() => {
    const stepOrder: CreateTokenStep[] = ['choose-type', 'token-info', 'review', 'deploying', 'success'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  }, [step]);

  const goToPreviousStep = useCallback(() => {
    const stepOrder: CreateTokenStep[] = ['choose-type', 'token-info', 'review', 'deploying', 'success'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  }, [step]);

  const startDeployment = useCallback(async () => {
    if (!tokenType) return;
    
    const formData = form.getValues();
    
    // Validate form before deployment
    const isValid = await form.trigger();
    if (!isValid) {
      setDeployError('Please fix form errors before deploying');
      return;
    }

    setIsDeploying(true);
    setDeployError(null);
    setStep('deploying');
    setDeployingStep(0);

    try {
      if (tokenType === 'ethereum-enabled') {
        // Ethereum-enabled: Deploy L1 first, then L2
        // Check if on correct chain for L1
        if (!l1Factory.isConnected) {
          throw new Error('Wallet not connected');
        }
        if (!l1Factory.isCorrectChain) {
          throw new Error('Please switch to Sepolia network to deploy L1 token');
        }
        
        setDeployingStep(1);
        await l1Factory.createToken({
          name: formData.name,
          symbol: formData.symbol,
          initialSupply: formData.initialSupply,
        });
        // The useEffect will handle the rest when L1 completes
        
      } else {
        // Celo-native: Deploy only on L2
        if (!l2Factory.isConnected) {
          throw new Error('Wallet not connected');
        }
        if (!l2Factory.isCorrectChain) {
          throw new Error('Please switch to Celo Alfajores network to deploy L2 token');
        }
        
        setDeployingStep(1);
        await l2Factory.createToken({
          name: formData.name,
          symbol: formData.symbol,
          decimals: formData.decimals,
          maxSupply: formData.maxSupply,
        });
        // The useEffect will handle success/error
      }
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : 'Deployment failed');
      setStep('review');
      setIsDeploying(false);
    }
  }, [tokenType, form, l1Factory, l2Factory]);

  const reset = useCallback(() => {
    setTokenType(null);
    setStep('choose-type');
    setDeployingStep(0);
    setDeploymentResult(null);
    setIsDeploying(false);
    setDeployError(null);
    form.reset(defaultTokenFormValues);
    l2Factory.resetMintState();
  }, [form, l2Factory]);

  // Combined loading state
  const combinedIsDeploying = isDeploying || l1Factory.isLoading || l2Factory.isLoading || l2Factory.isMinting;
  
  // Combined error state
  const combinedError = deployError || l1Factory.error || l2Factory.error || l2Factory.mintError;

  return {
    form,
    tokenType,
    setTokenType,
    step,
    setStep,
    goToNextStep,
    goToPreviousStep,
    deployingStep,
    deploymentResult,
    isDeploying: combinedIsDeploying,
    deployError: combinedError,
    startDeployment,
    reset,
    // Expose factory states for UI
    l1Factory: {
      isConnected: l1Factory.isConnected,
      isCorrectChain: l1Factory.isCorrectChain,
      isLoading: l1Factory.isLoading,
    },
    l2Factory: {
      isConnected: l2Factory.isConnected,
      isCorrectChain: l2Factory.isCorrectChain,
      isLoading: l2Factory.isLoading,
    },
  };
}
