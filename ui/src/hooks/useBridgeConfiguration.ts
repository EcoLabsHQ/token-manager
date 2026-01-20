import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getAddress } from 'viem';
import { L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

export interface BridgeConfigParams {
  l1TokenAddress: string;
  l2TokenAddress: string;
  l1BridgeAddress?: string;
  l2BridgeAddress?: string;
}

export const useBridgeConfiguration = () => {
  const { writeContract: writeL1, data: l1Data, isPending: isL1Pending, error: l1Error } = useWriteContract();
  const { writeContract: writeL2, data: l2Data, isPending: isL2Pending, error: l2Error } = useWriteContract();

  const { isLoading: isL1Receipt } = useWaitForTransactionReceipt({
    hash: l1Data,
    confirmations: 1,
  });

  const { isLoading: isL2Receipt } = useWaitForTransactionReceipt({
    hash: l2Data,
    confirmations: 1,
  });

  const configureBridge = useCallback(
    async (config: BridgeConfigParams) => {
      try {
        // Set L2 remote token to L1 token
        writeL2({
          address: getAddress(config.l2TokenAddress),
          abi: L2_SUPERCHAIN_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(config.l1TokenAddress)],
        });

        // Set L1 remote token to L2 token
        writeL1({
          address: getAddress(config.l1TokenAddress),
          abi: L1_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(config.l2TokenAddress)],
        });

        // Optional: Set bridge addresses if provided
        if (config.l1BridgeAddress) {
          writeL1({
            address: getAddress(config.l1TokenAddress),
            abi: L1_TOKEN_ABI,
            functionName: 'setBridge',
            args: [getAddress(config.l1BridgeAddress)],
          });
        }

        if (config.l2BridgeAddress) {
          writeL2({
            address: getAddress(config.l2TokenAddress),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'setBridge',
            args: [getAddress(config.l2BridgeAddress)],
          });
        }

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to configure bridge';
        return { success: false, error: errorMessage };
      }
    },
    [writeL1, writeL2]
  );

  return {
    configureBridge,
    isLoading: isL1Pending || isL2Pending || isL1Receipt || isL2Receipt,
    error: l1Error || l2Error,
    l1TxHash: l1Data,
    l2TxHash: l2Data,
  };
};
