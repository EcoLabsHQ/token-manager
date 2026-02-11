import { useCallback, useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
  useReadContract,
} from 'wagmi';
import {
  getAddress,
  decodeEventLog,
  keccak256,
  toHex,
  type TransactionReceipt,
} from 'viem';
import { celoSepolia } from 'viem/chains';
import {
  CONTRACTS,
  L1_TOKEN_FACTORY_ABI,
} from '@/config/contracts';

export type MigrationStep = 
  | 'idle'
  | 'deploying-l1'
  | 'minting-to-bridge'
  | 'setting-remote-token'
  | 'setting-bridge'
  | 'complete'
  | 'error';

export interface MigrationParams {
  l2TokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  maxSupply: bigint;
}

export interface MigrationResult {
  success: boolean;
  l1TokenAddress?: string;
  error?: string;
}

// L1 Standard Bridge on Sepolia
const L1_STANDARD_BRIDGE = '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1';
// L2 Standard Bridge on Celo Sepolia
const L2_STANDARD_BRIDGE = celoSepolia.contracts.l2StandardBridge.address;

// ABI for L1Token mint
const L1_TOKEN_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    inputs: [
      { name: 'to_', type: 'address' },
      { name: 'amount_', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ABI for L2 token configuration
const L2_TOKEN_CONFIG_ABI = [
  {
    name: 'setRemoteToken',
    type: 'function',
    inputs: [{ name: '_remoteToken', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setBridge',
    type: 'function',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'remoteToken',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'bridge',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const extractToken = (r: TransactionReceipt, abi: any): string | null => {
  for (const log of r.logs)
    try {
      const d = decodeEventLog({ abi, data: log.data, topics: log.topics }) as { 
        eventName: string; 
        args: { tokenAddress: string } 
      };
      if (d.eventName === 'TokenCreated') return d.args.tokenAddress;
    } catch {}
  return null;
};

export function useMigrateToEthereum() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [stepNumber, setStepNumber] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [l1TokenAddress, setL1TokenAddress] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<{
    deployL1?: string;
    mintToBridge?: string;
    setRemoteToken?: string;
    setBridge?: string;
  }>({});

  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const l1Client = usePublicClient({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
  const l2Client = usePublicClient({ chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId });
  const { switchChainAsync } = useSwitchChain();

  // Read creation fee
  const { data: l1CreationFee } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'creationFee',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  });

  const sendTx = async (params: any, publicClient: any, targetChainId: number) => {
    if (chainId !== targetChainId) {
      await switchChainAsync({ chainId: targetChainId });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const hash = await walletClient!.writeContract(params);
    const receipt = await publicClient!.waitForTransactionReceipt({ 
      hash, 
      confirmations: 1, 
      timeout: 120_000 
    });
    if (receipt.status === 'reverted') throw new Error('Transaction reverted');
    return { hash, receipt };
  };

  const migrate = useCallback(async (params: MigrationParams): Promise<MigrationResult> => {
    if (!address || !walletClient) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsProcessing(true);
    setError(null);
    setTxHashes({});

    try {
      // Step 1: Deploy L1 Token
      setStep('deploying-l1');
      setStepNumber(1);

      // Generate salt for the L1 token deployment
      // Note: Since L2 token already exists, addresses won't match, but we need a valid salt
      const salt = keccak256(toHex(`${address}-${params.name}-${params.symbol}-${Date.now()}`));

      // Create L1 token with 0 initial supply (we'll mint to bridge)
      // ABI order: owner_, name_, symbol_, decimals_, initialSupply_, maxSupply_, salt_
      const { hash: deployHash, receipt: deployReceipt } = await sendTx(
        {
          address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
          abi: L1_TOKEN_FACTORY_ABI,
          functionName: 'createToken',
          args: [
            getAddress(address),  // owner_
            params.name,          // name_
            params.symbol,        // symbol_
            params.decimals,      // decimals_
            0n,                   // initialSupply_ = 0 (will mint to bridge later)
            params.maxSupply,     // maxSupply_
            salt,                 // salt_
          ],
          value: l1CreationFee ?? 0n,
          chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
        },
        l1Client,
        CONTRACTS.L1_TOKEN_FACTORY.chainId
      );

      setTxHashes(prev => ({ ...prev, deployL1: deployHash }));

      const newL1TokenAddress = extractToken(deployReceipt, L1_TOKEN_FACTORY_ABI);
      if (!newL1TokenAddress) {
        throw new Error('Failed to extract L1 token address from receipt');
      }
      setL1TokenAddress(newL1TokenAddress);

      // Step 2: Mint current supply to the L1 Standard Bridge (lock supply)
      setStep('minting-to-bridge');
      setStepNumber(2);

      if (params.totalSupply > 0n) {
        const { hash: mintHash } = await sendTx(
          {
            address: getAddress(newL1TokenAddress),
            abi: L1_TOKEN_MINT_ABI,
            functionName: 'mint',
            args: [getAddress(L1_STANDARD_BRIDGE), params.totalSupply],
            chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
          },
          l1Client,
          CONTRACTS.L1_TOKEN_FACTORY.chainId
        );

        setTxHashes(prev => ({ ...prev, mintToBridge: mintHash }));
      }

      // Step 3: Set remote token on L2
      setStep('setting-remote-token');
      setStepNumber(3);

      const { hash: remoteHash } = await sendTx(
        {
          address: getAddress(params.l2TokenAddress),
          abi: L2_TOKEN_CONFIG_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(newL1TokenAddress)],
          chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any,
        },
        l2Client,
        CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId
      );

      setTxHashes(prev => ({ ...prev, setRemoteToken: remoteHash }));

      // Step 4: Set bridge on L2
      setStep('setting-bridge');
      setStepNumber(4);

      const { hash: bridgeHash } = await sendTx(
        {
          address: getAddress(params.l2TokenAddress),
          abi: L2_TOKEN_CONFIG_ABI,
          functionName: 'setBridge',
          args: [getAddress(L2_STANDARD_BRIDGE)],
          chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any,
        },
        l2Client,
        CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId
      );

      setTxHashes(prev => ({ ...prev, setBridge: bridgeHash }));

      // Complete!
      setStep('complete');
      setStepNumber(5);

      return { success: true, l1TokenAddress: newL1TokenAddress };
    } catch (err: any) {
      console.error('Migration error:', err);
      const errorMessage = err.message || 'Migration failed';
      setError(errorMessage);
      setStep('error');
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  }, [address, walletClient, l1Client, l2Client, switchChainAsync, l1CreationFee, chainId]);

  const reset = useCallback(() => {
    setStep('idle');
    setStepNumber(0);
    setError(null);
    setIsProcessing(false);
    setL1TokenAddress(null);
    setTxHashes({});
  }, []);

  return {
    migrate,
    reset,
    step,
    stepNumber,
    error,
    isProcessing,
    l1TokenAddress,
    txHashes,
    l1CreationFee: l1CreationFee ?? 0n,
    L1_STANDARD_BRIDGE,
    L2_STANDARD_BRIDGE,
  };
}
