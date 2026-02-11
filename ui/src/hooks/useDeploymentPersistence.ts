import { useState, useEffect, useCallback } from 'react';
import type { TokenFormData, TokenType } from '../lib/schemas';

const STORAGE_KEY = 'ecolabs_deployment_state';

export interface DeploymentState {
  // Deployment identification
  id: string;
  startedAt: number;
  
  // Token info
  tokenType: TokenType;
  formData: TokenFormData;
  
  // Progress tracking
  currentStep: number;
  
  // Created addresses
  l1TokenAddress?: string;
  l2TokenAddress?: string;
  
  // Transaction hashes for each step
  l1CreateTxHash?: string;
  l1MintTxHash?: string;
  l2CreateTxHash?: string;
  bridgeTxHash?: string;
  
  // Status
  status: 'in-progress' | 'completed' | 'failed';
  error?: string;
}

export function useDeploymentPersistence() {
  const [deploymentState, setDeploymentState] = useState<DeploymentState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DeploymentState;
        // Only restore if deployment was in progress
        if (parsed.status === 'in-progress') {
          console.log('Restored deployment state:', parsed);
          setDeploymentState(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load deployment state:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    if (deploymentState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deploymentState));
        console.log('Saved deployment state:', deploymentState);
      } catch (error) {
        console.error('Failed to save deployment state:', error);
      }
    }
  }, [deploymentState, isLoaded]);

  // Start a new deployment
  const startDeployment = useCallback((tokenType: TokenType, formData: TokenFormData): string => {
    const id = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newState: DeploymentState = {
      id,
      startedAt: Date.now(),
      tokenType,
      formData,
      currentStep: 0,
      status: 'in-progress',
    };
    setDeploymentState(newState);
    return id;
  }, []);

  // Update deployment progress
  const updateDeployment = useCallback((updates: Partial<DeploymentState>) => {
    setDeploymentState(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  // Mark L1 token created
  const setL1TokenCreated = useCallback((address: string, txHash?: string) => {
    updateDeployment({
      l1TokenAddress: address,
      l1CreateTxHash: txHash,
      currentStep: 1,
    });
  }, [updateDeployment]);

  // Mark L1 mint completed
  const setL1MintCompleted = useCallback((txHash?: string) => {
    updateDeployment({
      l1MintTxHash: txHash,
      currentStep: 2,
    });
  }, [updateDeployment]);

  // Mark L2 token created
  const setL2TokenCreated = useCallback((address: string, txHash?: string) => {
    updateDeployment({
      l2TokenAddress: address,
      l2CreateTxHash: txHash,
      currentStep: 3,
    });
  }, [updateDeployment]);

  // Mark bridge completed
  const setBridgeCompleted = useCallback((txHash?: string) => {
    updateDeployment({
      bridgeTxHash: txHash,
      currentStep: 5,
    });
  }, [updateDeployment]);

  // Mark deployment as completed
  const completeDeployment = useCallback(() => {
    setDeploymentState(prev => {
      if (!prev) return null;
      return { ...prev, status: 'completed' };
    });
  }, []);

  // Mark deployment as failed
  const failDeployment = useCallback((error: string) => {
    setDeploymentState(prev => {
      if (!prev) return null;
      return { ...prev, status: 'failed', error };
    });
  }, []);

  // Clear deployment state (after success or explicit cancel)
  const clearDeployment = useCallback(() => {
    setDeploymentState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear deployment state:', error);
    }
  }, []);

  // Check if there's a resumable deployment
  const hasResumableDeployment = deploymentState?.status === 'in-progress';

  // Get the step to resume from based on what's already done
  const getResumeStep = useCallback((): number => {
    if (!deploymentState) return 0;
    
    // For ethereum-enabled tokens
    if (deploymentState.tokenType === 'ethereum-enabled') {
      if (deploymentState.bridgeTxHash) return 6; // Already bridged, just need to complete
      if (deploymentState.l2TokenAddress) return 4; // L2 created, need to bridge
      if (deploymentState.l1MintTxHash) return 3; // L1 minted, need to create L2
      if (deploymentState.l1TokenAddress) return 2; // L1 created, need to mint
      return 1; // Need to create L1
    }
    
    // For celo-native tokens
    if (deploymentState.tokenType === 'celo-native') {
      if (deploymentState.l2TokenAddress) return 2; // L2 created, need to mint
      return 1; // Need to create L2
    }
    
    return 0;
  }, [deploymentState]);

  return {
    deploymentState,
    isLoaded,
    hasResumableDeployment,
    startDeployment,
    updateDeployment,
    setL1TokenCreated,
    setL1MintCompleted,
    setL2TokenCreated,
    setBridgeCompleted,
    completeDeployment,
    failDeployment,
    clearDeployment,
    getResumeStep,
  };
}
