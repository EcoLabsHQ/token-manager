import { useState, useCallback } from 'react';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { parseUnits, type Hash, type Address } from 'viem';
import { getPublicClient, getWalletClient } from 'wagmi/actions';
import { celoSepolia } from 'viem/chains';
import {
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
} from 'viem/op-stack';
import { CONTRACTS } from '@/config/contracts';
import { withdrawOptimismERC20 } from '@eth-optimism/viem/actions';

// Types
export type WithdrawalStatus =
  | 'waiting-to-prove'
  | 'ready-to-prove'
  | 'waiting-to-finalize'
  | 'ready-to-finalize'
  | 'finalized';

export interface PendingWithdrawal {
  l2TxHash: Hash;
  l2TokenAddress: string;
  l1TokenAddress: string;
  amount: string;
  status: WithdrawalStatus;
}

const L1_CHAIN_ID = CONTRACTS.L1_TOKEN_FACTORY.chainId;
const L2_CHAIN_ID = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;

export function useWithdraw() {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<
    'idle' | 'initiating' | 'proving' | 'finalizing'
  >('idle');

  // Helper to switch chain
  const ensureChain = useCallback(
    async (targetChainId: number) => {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
        await new Promise((r) => setTimeout(r, 300));
      }
    },
    [chainId, switchChainAsync],
  );

  // Step 1: Initiate withdrawal on L2 using bridgeERC20To
  const initiateWithdrawal = useCallback(
    async (params: {
      l2TokenAddress: string;
      l1TokenAddress: string;
      amount: string;
      decimals: number;
    }): Promise<{ success: boolean; txHash?: Hash; error?: string }> => {
      if (!address) return { success: false, error: 'Wallet not connected' };

      setIsLoading(true);
      setStep('initiating');

      try {
        await ensureChain(L2_CHAIN_ID);

        const walletClientL2 = await getWalletClient(config, {
          chainId: L2_CHAIN_ID,
        });
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        });
        if (!walletClientL2 || !publicClientL2)
          throw new Error('Failed to get L2 clients');

        const amountBigInt = parseUnits(params.amount, params.decimals);

        const withdrawalHash = await withdrawOptimismERC20(walletClientL2, {
          tokenAddress: params.l2TokenAddress as Address,
          amount: amountBigInt,
          to: walletClientL2.account.address,
          minGasLimit: 200000,
        });

        console.log(`Withdrawal transaction hash on L2: ${withdrawalHash}`);

        // Wait for L2 transaction receipt
        const withdrawalReceipt =
          await publicClientL2.waitForTransactionReceipt({
            hash: withdrawalHash,
            confirmations: 1,
          });
        console.log(
          `L2 transaction confirmed in block ${withdrawalReceipt.blockNumber}`,
        );

        if (withdrawalReceipt.status === 'reverted') {
          throw new Error('Transaction reverted');
        }

        return { success: true, txHash: withdrawalHash };
      } catch (err) {
        console.error('Initiate withdrawal error:', err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to initiate withdrawal',
        };
      } finally {
        setIsLoading(false);
        setStep('idle');
      }
    },
    [address, config, ensureChain],
  );

  // Step 2: Prove withdrawal on L1
  const proveWithdrawal = useCallback(
    async (
      l2TxHash: Hash,
    ): Promise<{ success: boolean; txHash?: Hash; error?: string }> => {
      if (!address) return { success: false, error: 'Wallet not connected' };

      setIsLoading(true);
      setStep('proving');

      try {
        await ensureChain(L1_CHAIN_ID);

        // Get L1 and L2 clients with OP Stack extensions
        const publicClientL1 = getPublicClient(config, {
          chainId: L1_CHAIN_ID,
        })?.extend(publicActionsL1());
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        })?.extend(publicActionsL2());
        const walletClientL1 = (
          await getWalletClient(config, { chainId: L1_CHAIN_ID })
        )?.extend(walletActionsL1());

        if (!publicClientL1 || !publicClientL2 || !walletClientL1) {
          throw new Error('Failed to get clients');
        }

        // Get L2 receipt
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });
        console.log('Got withdrawal receipt');

        // Wait until ready to prove
        console.log('Waiting for withdrawal to be provable...');
        const { output, withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoSepolia as any,
        });
        console.log('Withdrawal is ready to prove');

        // Build prove args
        const proveArgs = await publicClientL2.buildProveWithdrawal({
          output,
          withdrawal,
        });

        // Prove on L1 (cast to any to avoid complex viem type issues)
        const proveHash = await (walletClientL1 as any).proveWithdrawal(
          proveArgs,
        );
        console.log(`Prove transaction hash: ${proveHash}`);

        const proveReceipt = await publicClientL1.waitForTransactionReceipt({
          hash: proveHash,
        });
        console.log('Prove transaction confirmed:', proveReceipt.status);

        return { success: true, txHash: proveHash };
      } catch (err) {
        console.error('Prove withdrawal error:', err);
        return {
          success: false,
          error:
            err instanceof Error ? err.message : 'Failed to prove withdrawal',
        };
      } finally {
        setIsLoading(false);
        setStep('idle');
      }
    },
    [address, config, ensureChain],
  );

  // Step 3: Finalize withdrawal on L1
  const finalizeWithdrawal = useCallback(
    async (
      l2TxHash: Hash,
    ): Promise<{ success: boolean; txHash?: Hash; error?: string }> => {
      if (!address) return { success: false, error: 'Wallet not connected' };

      setIsLoading(true);
      setStep('finalizing');

      try {
        await ensureChain(L1_CHAIN_ID);

        // Get clients
        const publicClientL1 = getPublicClient(config, {
          chainId: L1_CHAIN_ID,
        })?.extend(publicActionsL1());
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        })?.extend(publicActionsL2());
        const walletClientL1 = (
          await getWalletClient(config, { chainId: L1_CHAIN_ID })
        )?.extend(walletActionsL1());

        if (!publicClientL1 || !publicClientL2 || !walletClientL1) {
          throw new Error('Failed to get clients');
        }

        // Get receipt and build withdrawal
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        // Wait to prove first to get the withdrawal object
        const { withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoSepolia as any,
        });

        // Wait until ready to finalize
        console.log('Waiting for withdrawal to be finalizable...');
        await publicClientL1.waitToFinalize({
          targetChain: celoSepolia as any,
          withdrawalHash: withdrawal.withdrawalHash,
        });
        console.log('Withdrawal is ready to finalize');

        // Finalize (cast to any to avoid complex viem type issues)
        const finalizeHash = await (walletClientL1 as any).finalizeWithdrawal({
          targetChain: celoSepolia as any,
          withdrawal,
        });
        console.log(`Finalize transaction hash: ${finalizeHash}`);

        const finalizeReceipt = await publicClientL1.waitForTransactionReceipt({
          hash: finalizeHash,
        });
        console.log('Finalize transaction confirmed:', finalizeReceipt.status);

        return { success: true, txHash: finalizeHash };
      } catch (err) {
        console.error('Finalize withdrawal error:', err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to finalize withdrawal',
        };
      } finally {
        setIsLoading(false);
        setStep('idle');
      }
    },
    [address, config, ensureChain],
  );

  // Get withdrawal status
  const getWithdrawalStatus = useCallback(
    async (l2TxHash: Hash): Promise<WithdrawalStatus | null> => {
      try {
        const publicClientL1 = getPublicClient(config, {
          chainId: L1_CHAIN_ID,
        })?.extend(publicActionsL1());
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        })?.extend(publicActionsL2());

        if (!publicClientL1 || !publicClientL2) return null;

        const receipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });
        const status = await publicClientL1.getWithdrawalStatus({
          receipt,
          targetChain: celoSepolia as any,
        });

        console.log('Withdrawal status:', status);
        return status as WithdrawalStatus;
      } catch (err) {
        console.error('Error getting withdrawal status:', err);
        return null;
      }
    },
    [config],
  );

  // Wait until withdrawal is ready to prove (call this to know when prove step can start)
  const waitForReadyToProve = useCallback(
    async (l2TxHash: Hash): Promise<{ ready: boolean; error?: string }> => {
      try {
        const publicClientL1 = getPublicClient(config, {
          chainId: L1_CHAIN_ID,
        })?.extend(publicActionsL1());
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        })?.extend(publicActionsL2());

        if (!publicClientL1 || !publicClientL2) {
          return { ready: false, error: 'Failed to get clients' };
        }

        // Get the L2 receipt
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        console.log('Waiting for withdrawal to be ready to prove...');

        console.debug(withdrawalReceipt);
        // This will wait until the state root is published on L1
        const { output, withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoSepolia,
        });

        console.debug(output, withdrawal);

        console.log('Withdrawal is ready to prove!', { output, withdrawal });
        return { ready: true };
      } catch (err) {
        console.error('Error waiting for ready to prove:', err);
        return {
          ready: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to check prove readiness',
        };
      }
    },
    [config],
  );

  // Wait until withdrawal is ready to finalize
  const waitForReadyToFinalize = useCallback(
    async (l2TxHash: Hash): Promise<{ ready: boolean; error?: string }> => {
      try {
        const publicClientL1 = getPublicClient(config, {
          chainId: L1_CHAIN_ID,
        })?.extend(publicActionsL1());
        const publicClientL2 = getPublicClient(config, {
          chainId: L2_CHAIN_ID,
        })?.extend(publicActionsL2());

        if (!publicClientL1 || !publicClientL2) {
          return { ready: false, error: 'Failed to get clients' };
        }

        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        // Get withdrawal object first
        const { withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoSepolia as any,
        });

        console.log('Waiting for withdrawal to be ready to finalize...');

        // Wait for finalization period to pass
        await publicClientL1.waitToFinalize({
          targetChain: celoSepolia as any,
          withdrawalHash: withdrawal.withdrawalHash,
        });

        console.log('Withdrawal is ready to finalize!');
        return { ready: true };
      } catch (err) {
        console.error('Error waiting for ready to finalize:', err);
        return {
          ready: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to check finalize readiness',
        };
      }
    },
    [config],
  );

  return {
    initiateWithdrawal,
    proveWithdrawal,
    finalizeWithdrawal,
    getWithdrawalStatus,
    waitForReadyToProve,
    waitForReadyToFinalize,
    isLoading,
    step,
    isInitiating: step === 'initiating',
    isProving: step === 'proving',
    isFinalizing: step === 'finalizing',
  };
}
