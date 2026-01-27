import { useCallback, useState, useEffect, useRef } from 'react';
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
import { useAutoChainSwitch } from './useAutoChainSwitch';
import { useDeploymentPersistence, type DeploymentState } from './useDeploymentPersistence';

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
  
  // Resume
  hasResumableDeployment: boolean;
  resumeDeployment: () => Promise<void>;
  cancelResumableDeployment: () => void;
  
  // Reset
  reset: () => void;
  
  // Factory states
  l1Factory: FactoryState;
  l2Factory: FactoryState;
  
  // Chain switching
  isSwitchingChain: boolean;
}

export function useCreateToken(): UseCreateTokenReturn {
  const [tokenType, setTokenType] = useState<TokenType | null>(null);
  const [step, setStep] = useState<CreateTokenStep>('choose-type');
  const [deployingStep, setDeployingStep] = useState(0);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  
  // Ref to prevent duplicate chain switches
  const chainSwitchInProgress = useRef(false);
  
  const { addToken } = useTokenStorage();
  
  // Factory hooks
  const l1Factory = useL1TokenFactory();
  const l2Factory = useL2TokenFactory();
  
  // Chain switching
  const chainSwitch = useAutoChainSwitch();
  
  // Persistence
  const persistence = useDeploymentPersistence();

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: defaultTokenFormValues,
    mode: 'onChange',
  });

  // Helper to switch chain and execute action
  const switchChainAndExecute = useCallback(async (
    target: 'l1' | 'l2',
    action: () => Promise<void>
  ): Promise<boolean> => {
    if (chainSwitchInProgress.current) {
      console.log('Chain switch already in progress, skipping...');
      return false;
    }
    
    chainSwitchInProgress.current = true;
    
    try {
      const result = await chainSwitch.ensureChain(target);
      if (!result.success) {
        setDeployError(result.error || `Failed to switch to ${target === 'l1' ? 'Sepolia' : 'Celo Sepolia'}`);
        chainSwitchInProgress.current = false;
        return false;
      }
      
      // Small delay after chain switch to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await action();
      chainSwitchInProgress.current = false;
      return true;
    } catch (error) {
      chainSwitchInProgress.current = false;
      throw error;
    }
  }, [chainSwitch]);

  // Monitor L1 factory completion for ethereum-enabled tokens
  useEffect(() => {
    if (tokenType !== 'ethereum-enabled' || !isDeploying) return;
    
    const l1Result = l1Factory.getResult();
    if (l1Result && l1Result.success && l1Result.tokenAddress && deployingStep === 1) {
      console.log('L1 token created:', l1Result.tokenAddress);
      
      // Save to persistence
      persistence.setL1TokenCreated(l1Result.tokenAddress, l1Result.txHash);
      
      const formData = form.getValues();
      const initialSupply = formData.initialSupply;
      
      // After L1 creation, mint initial supply on L1 if > 0
      if (Number(initialSupply) > 0 && l1Factory.userAddress) {
        console.log('Starting L1 initial supply mint...');
        setDeployingStep(2); // Move to L1 minting step
        
        l1Factory.mintInitialSupply({
          tokenAddress: l1Result.tokenAddress,
          to: l1Factory.userAddress,
          amount: initialSupply,
          decimals: 18,
        });
      } else {
        // No initial supply to mint, switch to L2 and create token
        console.log('No initial supply, switching to L2 to create token...');
        setDeployingStep(3);
        
        switchChainAndExecute('l2', async () => {
          await l2Factory.createToken({
            name: formData.name,
            symbol: formData.symbol,
            decimals: formData.decimals,
            maxSupply: formData.maxSupply,
          });
        });
      }
    } else if (l1Result && !l1Result.success && l1Result.error) {
      setDeployError(l1Result.error);
      persistence.failDeployment(l1Result.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l1Factory, deployingStep, form, l2Factory, persistence, switchChainAndExecute]);

  // Monitor L2 factory completion
  useEffect(() => {
    if (!isDeploying) return;
    
    const l2Result = l2Factory.getResult();
    
    if (tokenType === 'celo-native' && l2Result && l2Result.success && l2Result.tokenAddress) {
      // Celo-native token created, now mint initial supply
      console.log('L2 token created (celo-native):', l2Result.tokenAddress);
      
      // Save to persistence
      persistence.setL2TokenCreated(l2Result.tokenAddress, l2Result.txHash);
      
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
        
        persistence.completeDeployment();
        setDeployingStep(2);
        setTimeout(() => {
          setStep('success');
          persistence.clearDeployment();
        }, 1000);
        setIsDeploying(false);
      }
      
    } else if (tokenType === 'ethereum-enabled' && deployingStep === 3 && l2Result && l2Result.success && l2Result.tokenAddress) {
      // Ethereum-enabled: L2 token created (step 3), now configure bridge and bridge tokens
      console.log('L2 token created (ethereum-enabled):', l2Result.tokenAddress);
      
      // Save to persistence
      persistence.setL2TokenCreated(l2Result.tokenAddress, l2Result.txHash);
      
      const formData = form.getValues();
      const initialSupply = formData.initialSupply;
      const l1Result = l1Factory.getResult();
      
      // Only bridge if initialSupply > 0 and L1 token exists
      if (Number(initialSupply) > 0 && l1Result?.tokenAddress) {
        console.log('Configuring bridge connection...');
        setDeployingStep(4); // Move to bridge config step
        
        // Small delay for UI, then switch back to L1 and start bridge
        setTimeout(async () => {
          console.log('Switching back to L1 to bridge tokens...');
          setDeployingStep(5); // Move to bridging step
          
          await switchChainAndExecute('l1', async () => {
            await l1Factory.bridgeToL2({
              l1TokenAddress: l1Result.tokenAddress!,
              l2TokenAddress: l2Result.tokenAddress!,
              amount: initialSupply,
              decimals: 18,
            });
          });
        }, 1500);
      } else {
        // No initial supply to bridge, complete deployment
        setDeployingStep(6);
        
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
        
        persistence.completeDeployment();
        setTimeout(() => {
          setStep('success');
          persistence.clearDeployment();
        }, 1000);
        setIsDeploying(false);
      }
      
    } else if (l2Result && !l2Result.success && l2Result.error) {
      setDeployError(l2Result.error);
      persistence.failDeployment(l2Result.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l2Factory, deployingStep, form, addToken, l1Factory, persistence, switchChainAndExecute]);

  // Monitor L1 mint completion for ethereum-enabled tokens
  useEffect(() => {
    if (tokenType !== 'ethereum-enabled' || !isDeploying) return;
    
    const l1MintResult = l1Factory.getMintResult();
    const l1Result = l1Factory.getResult();
    
    if (deployingStep === 2 && l1MintResult && l1MintResult.success && l1Result?.tokenAddress) {
      // L1 mint complete, now switch to L2 and create token
      console.log('L1 initial supply minted, switching to L2 to create token...');
      
      // Save to persistence
      persistence.setL1MintCompleted(l1MintResult.txHash);
      
      setDeployingStep(3); // Move to L2 creation step
      
      const formData = form.getValues();
      
      switchChainAndExecute('l2', async () => {
        await l2Factory.createToken({
          name: formData.name,
          symbol: formData.symbol,
          decimals: formData.decimals,
          maxSupply: formData.maxSupply,
        });
      });
    } else if (l1MintResult && !l1MintResult.success && l1MintResult.error) {
      setDeployError(l1MintResult.error);
      persistence.failDeployment(l1MintResult.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l1Factory, deployingStep, form, l2Factory, persistence, switchChainAndExecute]);

  // Monitor L2 mint completion
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
      
      persistence.completeDeployment();
      setDeployingStep(3);
      setTimeout(() => {
        setStep('success');
        persistence.clearDeployment();
      }, 1000);
      setIsDeploying(false);
      
    } else if (tokenType === 'ethereum-enabled' && deployingStep === 5) {
      // Ethereum-enabled: Check bridge completion (step 5)
      const bridgeResult = l1Factory.getBridgeResult();
      const l2Result = l2Factory.getResult();
      const l1Result = l1Factory.getResult();
      
      if (bridgeResult && bridgeResult.success && l2Result?.tokenAddress) {
        console.log('Bridge to L2 complete (ethereum-enabled)');
        
        // Save to persistence
        persistence.setBridgeCompleted(bridgeResult.txHash);
        
        setDeployingStep(6);
        
        const formData = form.getValues();
        
        const result: DeploymentResult = {
          l1Address: l1Result?.tokenAddress,
          l2Address: l2Result.tokenAddress,
          txHash: bridgeResult.txHash,
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
        
        persistence.completeDeployment();
        setTimeout(() => {
          setStep('success');
          persistence.clearDeployment();
        }, 1000);
        setIsDeploying(false);
        
      } else if (bridgeResult && !bridgeResult.success && bridgeResult.error) {
        setDeployError(bridgeResult.error);
        persistence.failDeployment(bridgeResult.error);
        setIsDeploying(false);
        setStep('review');
      }
      
    } else if (mintResult && !mintResult.success && mintResult.error) {
      setDeployError(mintResult.error);
      persistence.failDeployment(mintResult.error);
      setIsDeploying(false);
      setStep('review');
    }
  }, [tokenType, isDeploying, l2Factory, deployingStep, form, addToken, l1Factory, persistence]);

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

    // Start persistence tracking
    persistence.startDeployment(tokenType, formData);

    setIsDeploying(true);
    setDeployError(null);
    setStep('deploying');
    setDeployingStep(0);

    try {
      if (tokenType === 'ethereum-enabled') {
        // Ethereum-enabled: Deploy L1 first, then L2
        if (!l1Factory.isConnected) {
          throw new Error('Wallet not connected');
        }
        
        // Auto-switch to L1 if needed
        const switchResult = await chainSwitch.ensureChain('l1');
        if (!switchResult.success) {
          throw new Error(switchResult.error || 'Failed to switch to Sepolia network');
        }
        
        // Small delay after chain switch
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
        
        // Auto-switch to L2 if needed
        const switchResult = await chainSwitch.ensureChain('l2');
        if (!switchResult.success) {
          throw new Error(switchResult.error || 'Failed to switch to Celo Sepolia network');
        }
        
        // Small delay after chain switch
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      setDeployError(errorMessage);
      persistence.failDeployment(errorMessage);
      setStep('review');
      setIsDeploying(false);
    }
  }, [tokenType, form, l1Factory, l2Factory, chainSwitch, persistence]);

  // Resume a paused deployment
  const resumeDeployment = useCallback(async () => {
    const state = persistence.deploymentState;
    if (!state || state.status !== 'in-progress') return;
    
    console.log('Resuming deployment from state:', state);
    
    // Restore form data and token type
    setTokenType(state.tokenType);
    form.reset(state.formData);
    
    setIsDeploying(true);
    setDeployError(null);
    setStep('deploying');
    
    const resumeStep = persistence.getResumeStep();
    setDeployingStep(resumeStep);
    
    try {
      if (state.tokenType === 'ethereum-enabled') {
        await resumeEthereumEnabledDeployment(state, resumeStep);
      } else {
        await resumeCeloNativeDeployment(state, resumeStep);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume deployment';
      setDeployError(errorMessage);
      persistence.failDeployment(errorMessage);
      setStep('review');
      setIsDeploying(false);
    }
  }, [persistence, form]);

  const resumeEthereumEnabledDeployment = useCallback(async (
    state: DeploymentState,
    resumeStep: number
  ) => {
    const formData = state.formData;
    
    if (resumeStep <= 1) {
      // Need to create L1 token
      await chainSwitch.ensureChain('l1');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(1);
      await l1Factory.createToken({
        name: formData.name,
        symbol: formData.symbol,
        initialSupply: formData.initialSupply,
      });
    } else if (resumeStep === 2) {
      // Need to mint L1 supply
      await chainSwitch.ensureChain('l1');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(2);
      await l1Factory.mintInitialSupply({
        tokenAddress: state.l1TokenAddress!,
        to: l1Factory.userAddress!,
        amount: formData.initialSupply,
        decimals: 18,
      });
    } else if (resumeStep === 3) {
      // Need to create L2 token
      await chainSwitch.ensureChain('l2');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(3);
      await l2Factory.createToken({
        name: formData.name,
        symbol: formData.symbol,
        decimals: formData.decimals,
        maxSupply: formData.maxSupply,
      });
    } else if (resumeStep === 4 || resumeStep === 5) {
      // Need to bridge tokens
      await chainSwitch.ensureChain('l1');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(5);
      await l1Factory.bridgeToL2({
        l1TokenAddress: state.l1TokenAddress!,
        l2TokenAddress: state.l2TokenAddress!,
        amount: formData.initialSupply,
        decimals: 18,
      });
    }
    // If resumeStep >= 6, deployment is complete, effects will handle it
  }, [chainSwitch, l1Factory, l2Factory]);

  const resumeCeloNativeDeployment = useCallback(async (
    state: DeploymentState,
    resumeStep: number
  ) => {
    const formData = state.formData;
    
    if (resumeStep <= 1) {
      // Need to create L2 token
      await chainSwitch.ensureChain('l2');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(1);
      await l2Factory.createToken({
        name: formData.name,
        symbol: formData.symbol,
        decimals: formData.decimals,
        maxSupply: formData.maxSupply,
      });
    } else if (resumeStep === 2) {
      // Need to mint supply
      await chainSwitch.ensureChain('l2');
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeployingStep(2);
      await l2Factory.mintInitialSupply({
        tokenAddress: state.l2TokenAddress!,
        to: l2Factory.userAddress!,
        amount: formData.initialSupply,
        decimals: formData.decimals,
      });
    }
    // If resumeStep >= 3, deployment is complete, effects will handle it
  }, [chainSwitch, l2Factory]);

  const cancelResumableDeployment = useCallback(() => {
    persistence.clearDeployment();
  }, [persistence]);

  const reset = useCallback(() => {
    setTokenType(null);
    setStep('choose-type');
    setDeployingStep(0);
    setDeploymentResult(null);
    setIsDeploying(false);
    setDeployError(null);
    chainSwitchInProgress.current = false;
    form.reset(defaultTokenFormValues);
    l2Factory.resetMintState();
    l1Factory.resetMintState();
    l1Factory.resetBridgeState();
    persistence.clearDeployment();
  }, [form, l2Factory, l1Factory, persistence]);

  // Combined loading state
  const combinedIsDeploying = isDeploying || l1Factory.isLoading || l2Factory.isLoading || l2Factory.isMinting || l1Factory.isMinting || l1Factory.isBridging;
  
  // Combined error state
  const combinedError = deployError || l1Factory.error || l2Factory.error || l2Factory.mintError || l1Factory.mintError || l1Factory.bridgeError;

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
    // Resume functionality
    hasResumableDeployment: persistence.hasResumableDeployment,
    resumeDeployment,
    cancelResumableDeployment,
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
    // Chain switching state
    isSwitchingChain: chainSwitch.isSwitching,
  };
}
