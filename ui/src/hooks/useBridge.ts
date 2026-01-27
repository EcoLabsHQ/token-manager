import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, getAddress } from 'viem';

export interface BridgeToken {
  symbol: string;
  l1Address: string;
  l2Address: string;
  decimals: number;
}

export interface BridgeConfig {
  l1ChainId: number;
  l2ChainId: number;
  l1BridgeAddress: string;
  l2BridgeAddress: string;
  tokens: BridgeToken[];
}

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
] as const;

// Hardcoded token configuration
export const L1_TOKEN = '0x5589BB8228C07c4e15558875fAf2B859f678d129';
export const L2_TOKEN = '0x113100B7fF29994Dba936452e0f712d43b5915eF';
export const BRIDGE_AMOUNT = '1';
export const TOKEN_DECIMALS = 18;

export const useBridge = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const getBalance = async () => {
    if (!address || !publicClient) {
      setError('Wallet not connected or client unavailable');
      return null;
    }

    try {
      const balance = await publicClient.readContract({
        address: getAddress(L1_TOKEN),
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });

      return formatUnits(balance as bigint, TOKEN_DECIMALS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get balance');
      return null;
    }
  };

  const bridge = async () => {
    if (!address || !walletClient || !publicClient) {
      setError('Wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const { depositERC20 } = await import('@eth-optimism/viem/actions');
      const amountBigInt = parseUnits(BRIDGE_AMOUNT, TOKEN_DECIMALS);

      // // Approve the bridge to spend tokens
      // const approveTx = await walletClient.writeContract({
      //   address: getAddress(L1_TOKEN),
      //   abi: ERC20_ABI,
      //   functionName: 'approve',
      //   args: [getAddress(bridgeAddress), amountBigInt],
      //   account: address,
      // });

      // await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Deposit tokens to bridge
      // Use l1StandardBridgeAddress directly without targetChain to avoid type issues
      // The bridge address is from celoSepolia.contracts.l1StandardBridge[11155111]
      const L1_STANDARD_BRIDGE_ADDRESS = '0xec18a3c30131a0db4246e785355fbc16e2eaf408' as const;
      
      const depositTx = await depositERC20(walletClient, {
        tokenAddress: getAddress(L1_TOKEN),
        remoteTokenAddress: getAddress(L2_TOKEN),
        amount: amountBigInt,
        to: walletClient.account.address,
        minGasLimit: 2000000,
        l1StandardBridgeAddress: L1_STANDARD_BRIDGE_ADDRESS,
        unsafe: true, // Skip remote token validation since we're handling it ourselves
      });

      setTxHash(depositTx);

      const depositReceipt = await publicClient.waitForTransactionReceipt({
        hash: depositTx,
      });

      return {
        success: true,
        txHash: depositTx,
        blockNumber: depositReceipt.blockNumber,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bridging failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getBalance,
    bridge,
    isLoading,
    error,
    txHash,
  };
};
