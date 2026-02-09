import { useCallback, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export type TargetChain = 'l1' | 'l2';

export interface ChainSwitchResult {
  success: boolean;
  error?: string;
}

export function useAutoChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const l1ChainId = CONTRACTS.L1_TOKEN_FACTORY.chainId;
  const l2ChainId = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;

  const isOnL1 = chainId === l1ChainId;
  const isOnL2 = chainId === l2ChainId;

  // Switch to a specific chain
  const switchToChain = useCallback(
    async (target: TargetChain): Promise<ChainSwitchResult> => {
      const targetChainId = target === 'l1' ? l1ChainId : l2ChainId;
      const targetName = target === 'l1' ? 'Ethereum' : 'Celo';

      // Already on the correct chain
      if (chainId === targetChainId) {
        return { success: true };
      }

      setIsSwitching(true);
      setError(null);

      try {
        console.log(`Switching to ${targetName} (Chain ID: ${targetChainId})...`);
        await switchChainAsync({ chainId: targetChainId });
        console.log(`Successfully switched to ${targetName}`);
        setIsSwitching(false);
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to switch to ${targetName}`;
        console.error('Chain switch error:', errorMessage);
        setError(errorMessage);
        setIsSwitching(false);
        return { success: false, error: errorMessage };
      }
    },
    [chainId, l1ChainId, l2ChainId, switchChainAsync]
  );

  // Switch to L1 (Ethereum)
  const switchToL1 = useCallback(async (): Promise<ChainSwitchResult> => {
    return switchToChain('l1');
  }, [switchToChain]);

  // Switch to L2 (Celo)
  const switchToL2 = useCallback(async (): Promise<ChainSwitchResult> => {
    return switchToChain('l2');
  }, [switchToChain]);

  // Ensure we're on the correct chain before an operation
  const ensureChain = useCallback(
    async (target: TargetChain): Promise<ChainSwitchResult> => {
      const targetChainId = target === 'l1' ? l1ChainId : l2ChainId;
      
      if (chainId === targetChainId) {
        return { success: true };
      }
      
      return switchToChain(target);
    },
    [chainId, l1ChainId, l2ChainId, switchToChain]
  );

  return {
    // Current state
    currentChainId: chainId,
    isOnL1,
    isOnL2,
    isSwitching: isSwitching || isPending,
    error,
    
    // Chain IDs
    l1ChainId,
    l2ChainId,
    
    // Actions
    switchToL1,
    switchToL2,
    switchToChain,
    ensureChain,
  };
}
