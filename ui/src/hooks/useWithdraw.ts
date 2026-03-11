import { useState, useCallback } from 'react';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { parseUnits, type Hash, type Address } from 'viem';
import { getPublicClient, getWalletClient } from 'wagmi/actions';
import { celoOpStack } from '@/config/chains';
import {
  walletActionsL1,
} from 'viem/op-stack';
import { CONTRACTS } from '@/config/contracts';
import { withdrawOptimismERC20 } from '@eth-optimism/viem/actions';
import { archivePublicClientL2, archivePublicClientL1 } from '@/lib/viemClient';

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
  // If existingProveTxHash is provided, will verify it's already proven and skip re-proving
  const proveWithdrawal = useCallback(
    async (
      l2TxHash: Hash,
      existingProveTxHash?: Hash,
    ): Promise<{ success: boolean; txHash?: Hash; error?: string; alreadyProven?: boolean }> => {
      if (!address) return { success: false, error: 'Wallet not connected' };

      setIsLoading(true);
      setStep('proving');

      try {
        await ensureChain(L1_CHAIN_ID);

        // Get L1 and L2 clients with OP Stack extensions.
        // IMPORTANT: publicClientL2 MUST use an archive node (Forno) because
        // buildProveWithdrawal calls eth_getProof on historical L2 state.
        // WalletConnect's RPC proxy does NOT serve archived trie nodes.
        const walletClientL1 = (
          await getWalletClient(config, { chainId: L1_CHAIN_ID })
        )?.extend(walletActionsL1());

        // Use dedicated archive clients for proof reads
        const publicClientL1 = archivePublicClientL1;
        const publicClientL2 = archivePublicClientL2;

        if (!walletClientL1) {
          throw new Error('Failed to get clients');
        }

        // Get L2 receipt
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        // Check current withdrawal status on-chain
        const currentStatus = await publicClientL1.getWithdrawalStatus({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
        });

        console.log('Current withdrawal status:', currentStatus);

        // If already proven or ready to finalize, skip proving
        if (currentStatus === 'waiting-to-finalize' || currentStatus === 'ready-to-finalize' || currentStatus === 'finalized') {
          console.log('Withdrawal already proven, skipping prove step');
          return { 
            success: true, 
            txHash: existingProveTxHash, 
            alreadyProven: true 
          };
        }

        console.log('Got withdrawal receipt');

        // Wait until ready to prove
        console.log('Waiting for withdrawal to be provable...');
        const { output, withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
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
  // If existingFinalizeTxHash is provided, will verify it's already finalized and skip
  const finalizeWithdrawal = useCallback(
    async (
      l2TxHash: Hash,
      existingFinalizeTxHash?: Hash,
    ): Promise<{ success: boolean; txHash?: Hash; error?: string; alreadyFinalized?: boolean }> => {
      if (!address) return { success: false, error: 'Wallet not connected' };

      setIsLoading(true);
      setStep('finalizing');

      try {
        await ensureChain(L1_CHAIN_ID);

        // Get clients
        const walletClientL1 = (
          await getWalletClient(config, { chainId: L1_CHAIN_ID })
        )?.extend(walletActionsL1());

        // Use dedicated archive clients — same reason as proveWithdrawal
        const publicClientL1 = archivePublicClientL1;
        const publicClientL2 = archivePublicClientL2;

        if (!walletClientL1) {
          throw new Error('Failed to get clients');
        }

        // Get receipt and check status
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        // Check current withdrawal status on-chain
        const currentStatus = await publicClientL1.getWithdrawalStatus({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
        });

        console.log('Current withdrawal status:', currentStatus);

        // If already finalized, skip finalizing
        if (currentStatus === 'finalized') {
          console.log('Withdrawal already finalized, skipping finalize step');
          return { 
            success: true, 
            txHash: existingFinalizeTxHash, 
            alreadyFinalized: true 
          };
        }

        // Wait to prove first to get the withdrawal object
        const { withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
        });

        // Wait until ready to finalize
        console.log('Waiting for withdrawal to be finalizable...');
        await publicClientL1.waitToFinalize({
          targetChain: celoOpStack as any,
          withdrawalHash: withdrawal.withdrawalHash,
        });
        console.log('Withdrawal is ready to finalize');

        // Finalize (cast to any to avoid complex viem type issues)
        const finalizeHash = await (walletClientL1 as any).finalizeWithdrawal({
          targetChain: celoOpStack as any,
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
        const publicClientL1 = archivePublicClientL1;
        const publicClientL2 = archivePublicClientL2;

        const receipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });
        const status = await publicClientL1.getWithdrawalStatus({
          receipt,
          targetChain: celoOpStack as any,
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
        const publicClientL1 = archivePublicClientL1;
        const publicClientL2 = archivePublicClientL2;

        // Get the L2 receipt
        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        console.log('Waiting for withdrawal to be ready to prove...');

        console.debug(withdrawalReceipt);
        // This will wait until the state root is published on L1
        const { output, withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
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
        const publicClientL1 = archivePublicClientL1;
        const publicClientL2 = archivePublicClientL2;

        const withdrawalReceipt = await publicClientL2.getTransactionReceipt({
          hash: l2TxHash,
        });

        // Get withdrawal object first
        const { withdrawal } = await publicClientL1.waitToProve({
          receipt: withdrawalReceipt,
          targetChain: celoOpStack as any,
        });

        console.log('Waiting for withdrawal to be ready to finalize...');

        // Wait for finalization period to pass
        await publicClientL1.waitToFinalize({
          targetChain: celoOpStack as any,
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
