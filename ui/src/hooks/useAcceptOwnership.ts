import { useCallback, useState } from 'react';
import { useAccount, useWriteContract, useSwitchChain, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { getAddress } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import type { PendingOwnershipTransfer } from './usePendingOwnershipTransfers';

// ABI for acceptOwnership (from Ownable2Step)
const ACCEPT_OWNERSHIP_ABI = [
  {
    name: 'acceptOwnership',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ABI for reading owner and pendingOwner
const OWNERSHIP_READ_ABI = [
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'pendingOwner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export interface AcceptOwnershipResult {
  success: boolean;
  txHash?: string;
  l1TxHash?: string;
  l2TxHash?: string;
  error?: string;
}

// Step numbers for progress tracking
export type AcceptOwnershipStep = 0 | 1 | 2 | 3; // 0=not started, 1=L1 in progress, 2=L2 in progress, 3=completed

export function useAcceptOwnership() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const [isLoading, setIsLoading] = useState(false);
  const [processingTokenId, setProcessingTokenId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AcceptOwnershipStep>(0);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDualChain, setIsDualChain] = useState(false);

  // Helper to check if user is already owner or pending owner on a chain
  const checkOwnershipStatus = useCallback(
    async (tokenAddress: string, targetChainId: number, userAddress: string): Promise<{ isOwner: boolean; isPendingOwner: boolean }> => {
      try {
        const publicClient = getPublicClient(config, { chainId: targetChainId });
        if (!publicClient) {
          return { isOwner: false, isPendingOwner: false };
        }

        const [owner, pendingOwner] = await Promise.all([
          publicClient.readContract({
            address: getAddress(tokenAddress),
            abi: OWNERSHIP_READ_ABI,
            functionName: 'owner',
          }),
          publicClient.readContract({
            address: getAddress(tokenAddress),
            abi: OWNERSHIP_READ_ABI,
            functionName: 'pendingOwner',
          }),
        ]);

        return {
          isOwner: owner.toLowerCase() === userAddress.toLowerCase(),
          isPendingOwner: pendingOwner.toLowerCase() === userAddress.toLowerCase(),
        };
      } catch (err) {
        console.warn('Failed to check ownership status:', err);
        return { isOwner: false, isPendingOwner: false };
      }
    },
    [config]
  );

  // Helper to accept ownership on a single chain
  const acceptOnChain = useCallback(
    async (tokenAddress: string, targetChainId: number): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      try {
        // Switch chain if needed
        if (chainId !== targetChainId) {
          console.log(`Switching chain from ${chainId} to ${targetChainId}...`);
          setIsSwitchingChain(true);
          await switchChainAsync({ chainId: targetChainId });
          await new Promise(resolve => setTimeout(resolve, 500));
          setIsSwitchingChain(false);
        }

        // Call acceptOwnership
        const txHash = await writeContractAsync({
          address: getAddress(tokenAddress),
          abi: ACCEPT_OWNERSHIP_ABI,
          functionName: 'acceptOwnership',
          chainId: targetChainId,
        });

        // Wait for confirmation
        const targetPublicClient = getPublicClient(config, { chainId: targetChainId });
        if (targetPublicClient) {
          await targetPublicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });
        }

        return { success: true, txHash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept ownership';
        setIsSwitchingChain(false);
        return { success: false, error: errorMessage };
      }
    },
    [chainId, switchChainAsync, writeContractAsync, config]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentStep(0);
    setIsDualChain(false);
  }, []);

  const acceptOwnership = useCallback(
    async (transfer: PendingOwnershipTransfer): Promise<AcceptOwnershipResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsLoading(true);
      setProcessingTokenId(transfer.id);
      setCurrentStep(0);

      try {
        // Check if this is an Ethereum Enabled token (has both L1 and L2)
        if (transfer.isEthereumEnabled && transfer.l1TokenAddress && transfer.l2TokenAddress) {
          setIsDualChain(true);
          setIsModalOpen(true);
          console.log('Accepting ownership for Ethereum Enabled token pair...');
          
          const l1ChainId = CONTRACTS.L1_TOKEN_FACTORY.chainId;
          const l2ChainId = CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
          
          // Check ownership status on both chains before attempting
          console.log('Checking current ownership status...');
          const [l1Status, l2Status] = await Promise.all([
            checkOwnershipStatus(transfer.l1TokenAddress, l1ChainId, address),
            checkOwnershipStatus(transfer.l2TokenAddress, l2ChainId, address),
          ]);
          
          console.log('L1 status:', l1Status, 'L2 status:', l2Status);
          
          // If already owner on both, nothing to do
          if (l1Status.isOwner && l2Status.isOwner) {
            setIsLoading(false);
            setProcessingTokenId(null);
            setIsModalOpen(false);
            setCurrentStep(0);
            return { success: true };
          }
          
          let l1TxHash: string | undefined;
          let l2TxHash: string | undefined;
          
          // Step 1: Accept on L1 (Ethereum Mainnet) - only if not already owner
          setCurrentStep(1);
          if (l1Status.isOwner) {
            console.log('Already owner on L1, skipping L1 acceptance...');
            // L1 already done, move to L2 quickly
          } else if (l1Status.isPendingOwner) {
            console.log(`Accepting L1 ownership on chain ${l1ChainId}...`);
            const l1Result = await acceptOnChain(transfer.l1TokenAddress, l1ChainId);
            
            if (!l1Result.success) {
              setIsLoading(false);
              setProcessingTokenId(null);
              setIsModalOpen(false);
              setCurrentStep(0);
              return { success: false, error: `L1 acceptance failed: ${l1Result.error}` };
            }
            
            l1TxHash = l1Result.txHash;
            console.log('L1 ownership accepted:', l1TxHash);
          } else {
            // Not owner and not pending owner on L1 - this shouldn't happen
            setIsLoading(false);
            setProcessingTokenId(null);
            setIsModalOpen(false);
            setCurrentStep(0);
            return { success: false, error: 'Not pending owner on L1' };
          }

          // Step 2: Accept on L2 (Celo) - only if not already owner
          setCurrentStep(2);
          if (l2Status.isOwner) {
            console.log('Already owner on L2, skipping L2 acceptance...');
          } else if (l2Status.isPendingOwner) {
            console.log(`Accepting L2 ownership on chain ${l2ChainId}...`);
            const l2Result = await acceptOnChain(transfer.l2TokenAddress, l2ChainId);
            
            if (!l2Result.success) {
              setIsLoading(false);
              setProcessingTokenId(null);
              return { 
                success: false, 
                l1TxHash: l1TxHash,
                error: `L2 acceptance failed: ${l2Result.error}. L1 was accepted successfully.` 
              };
            }
            
            l2TxHash = l2Result.txHash;
            console.log('L2 ownership accepted:', l2TxHash);
          } else {
            // Not owner and not pending owner on L2 - this shouldn't happen
            setIsLoading(false);
            setProcessingTokenId(null);
            setIsModalOpen(false);
            setCurrentStep(0);
            return { success: false, error: 'Not pending owner on L2' };
          }

          setCurrentStep(3);
          
          // Auto close modal after success
          setTimeout(() => {
            setIsLoading(false);
            setProcessingTokenId(null);
            setIsModalOpen(false);
            setCurrentStep(0);
          }, 1500);

          return { 
            success: true, 
            l1TxHash: l1TxHash, 
            l2TxHash: l2TxHash,
            txHash: l1TxHash || l2TxHash
          };
        }

        // Single chain token
        const expectedChainId = transfer.chain === 'ethereum' 
          ? CONTRACTS.L1_TOKEN_FACTORY.chainId 
          : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;

        const result = await acceptOnChain(transfer.tokenAddress, expectedChainId);
        
        setIsLoading(false);
        setProcessingTokenId(null);
        
        if (!result.success) {
          return { success: false, error: result.error };
        }

        console.log('Ownership accepted successfully:', result.txHash);
        return { success: true, txHash: result.txHash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept ownership';
        console.error('Accept ownership error:', errorMessage);
        setIsLoading(false);
        setProcessingTokenId(null);
        setIsModalOpen(false);
        setCurrentStep(0);
        return { success: false, error: errorMessage };
      }
    },
    [address, acceptOnChain, checkOwnershipStatus]
  );

  return {
    acceptOwnership,
    isLoading,
    processingTokenId,
    // Modal state
    isModalOpen,
    closeModal,
    currentStep,
    isSwitchingChain,
    isDualChain,
  };
}
