import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

export interface BridgeConfigParams {
  l1TokenAddress: string;
  l2TokenAddress: string;
  l1BridgeAddress?: string;
  l2BridgeAddress?: string;
}

/**
 * NOTE: This hook is currently not functional as setRemoteToken and setBridge
 * are no longer part of the token ABIs. Bridge configuration is now handled
 * automatically by the factory contracts during token creation.
 * 
 * This hook is kept for potential future use but will need to be updated
 * if manual bridge configuration is needed.
 */
export const useBridgeConfiguration = () => {
  const { data: l1Data, isPending: isL1Pending, error: l1Error } = useWriteContract();
  const { data: l2Data, isPending: isL2Pending, error: l2Error } = useWriteContract();

  const { isLoading: isL1Receipt } = useWaitForTransactionReceipt({
    hash: l1Data,
    confirmations: 1,
  });

  const { isLoading: isL2Receipt } = useWaitForTransactionReceipt({
    hash: l2Data,
    confirmations: 1,
  });

  const configureBridge = useCallback(
    async (_config: BridgeConfigParams) => {
      // Bridge configuration is now handled automatically by factory contracts
      // setRemoteToken and setBridge functions are no longer available in token ABIs
      console.warn('useBridgeConfiguration: Bridge configuration is now automatic in factory contracts');
      return { success: true };
    },
    []
  );

  return {
    configureBridge,
    isLoading: isL1Pending || isL2Pending || isL1Receipt || isL2Receipt,
    error: l1Error || l2Error,
    l1TxHash: l1Data,
    l2TxHash: l2Data,
  };
};
