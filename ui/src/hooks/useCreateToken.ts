import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from 'wagmi';
import {
  parseUnits,
  getAddress,
  toHex,
  decodeEventLog,
  type TransactionReceipt,
} from 'viem';
import { celoSepolia } from 'viem/chains';
import {
  tokenFormSchema,
  defaultTokenFormValues,
  type TokenFormData,
  type TokenType,
} from '../lib/schemas';
import { useTokenStorage } from './useTokenStorage';
import {
  CONTRACTS,
  L1_TOKEN_FACTORY_ABI,
  L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
} from '@/config/contracts';

export type CreateTokenStep =
  | 'choose-type'
  | 'token-info'
  | 'review'
  | 'deploying'
  | 'success';
type DeploymentResult = { l1Address?: string; l2Address: string };

const BRIDGE = '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1';
const APPROVE_ABI = [
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
] as const;
const BRIDGE_ABI = [
  {
    name: 'bridgeERC20To',
    type: 'function',
    inputs: [
      { name: '_localToken', type: 'address' },
      { name: '_remoteToken', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const SET_REMOTE_TOKEN_ABI = [{ name: 'setRemoteToken', type: 'function', inputs: [{ name: '_remoteToken', type: 'address' }], outputs: [], stateMutability: 'nonpayable' }] as const;
const SET_BRIDGE_ABI = [{ name: 'setBridge', type: 'function', inputs: [{ name: '_bridge', type: 'address' }], outputs: [], stateMutability: 'nonpayable' }] as const;
const L2_BRIDGE = celoSepolia.contracts.l2StandardBridge.address;

const extractToken = (r: TransactionReceipt, abi: any): string | null => {
  for (const log of r.logs)
    try {
      const d = decodeEventLog({ abi, data: log.data, topics: log.topics }) as { eventName: string; args: { tokenAddress: string } };
      if (d.eventName === 'TokenCreated') return d.args.tokenAddress;
    } catch {}
  return null;
};

export function useCreateToken() {
  const [tokenType, setTokenType] = useState<TokenType | null>(null);
  const [step, setStep] = useState<CreateTokenStep>('choose-type');
  const [deployingStep, setDeployingStep] = useState(0);
  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const l1Client = usePublicClient({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
  const l2Client = usePublicClient({ chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId });
  const { switchChainAsync } = useSwitchChain();
  const { addToken } = useTokenStorage();
  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: defaultTokenFormValues,
    mode: 'onChange',
  });

  const sendTx = async (params: any, publicClient: any) => {
    const targetChainId = params.chain?.id;
    if (targetChainId) {
      setIsSwitchingChain(true);
      try {
        await switchChainAsync({ chainId: targetChainId });
        await new Promise(resolve => setTimeout(resolve, 500));
      } finally {
        setIsSwitchingChain(false);
      }
    }
    const hash = await walletClient!.writeContract(params);
    const receipt = await publicClient!.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
    if (receipt.status === 'reverted') throw new Error('Transaction reverted');
    return receipt;
  };

  const startDeployment = useCallback(async () => {
    if (!tokenType || !address || !walletClient) return;
    const formData = form.getValues();
    if (!(await form.trigger())) {
      setDeployError('Fix form errors');
      return;
    }
    setIsDeploying(true);
    setDeployError(null);
    setStep('deploying');
    setDeployingStep(0);

    try {
      let result: DeploymentResult;
      const salt = toHex(`${formData.name}-${formData.symbol}-${Date.now()}`);

      if (tokenType === 'celo-native') {
        setDeployingStep(1);
        const receipt = await sendTx(
          {
            address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
            abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
            functionName: 'createToken',
            args: [
              getAddress(address),
              formData.name,
              formData.symbol,
              formData.decimals,
              parseUnits(formData.initialSupply, formData.decimals),
              parseUnits(formData.maxSupply, formData.decimals),
              salt,
            ],
            chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any,
          },
          l2Client,
        );
        const l2Addr = extractToken(receipt, L2_SUPERCHAIN_TOKEN_FACTORY_ABI)!;
        result = { l2Address: l2Addr };
      } else {
        setDeployingStep(1);
        const l1Receipt = await sendTx(
          {
            address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
            abi: L1_TOKEN_FACTORY_ABI,
            functionName: 'createToken',
            args: [formData.name, formData.symbol, parseUnits(formData.initialSupply, formData.decimals), parseUnits(formData.maxSupply, formData.decimals), formData.decimals, getAddress(address)],
            chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
          },
          l1Client,
        );
        const l1Addr = extractToken(l1Receipt, L1_TOKEN_FACTORY_ABI)!;

        setDeployingStep(2);
        const l2Receipt = await sendTx(
          {
            address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
            abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
            functionName: 'createToken',
            args: [getAddress(address), formData.name, formData.symbol, formData.decimals, parseUnits(formData.initialSupply, formData.decimals), parseUnits(formData.maxSupply, formData.decimals), salt],
            chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any,
          },
          l2Client,
        );
        const l2Addr = extractToken(l2Receipt, L2_SUPERCHAIN_TOKEN_FACTORY_ABI)!;

        // Configure bridge: setRemoteToken + setBridge
        setDeployingStep(3);
        await sendTx(
          { address: getAddress(l2Addr), abi: SET_REMOTE_TOKEN_ABI, functionName: 'setRemoteToken', args: [getAddress(l1Addr)], chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any },
          l2Client,
        );
        await sendTx(
          { address: getAddress(l2Addr), abi: SET_BRIDGE_ABI, functionName: 'setBridge', args: [getAddress(L2_BRIDGE)], chain: { id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId } as any },
          l2Client,
        );

        if (+formData.initialSupply > 0) {
          setDeployingStep(4);
          const amount = parseUnits(formData.initialSupply, 18);
          await sendTx(
            {
              address: getAddress(l1Addr),
              abi: APPROVE_ABI,
              functionName: 'approve',
              args: [getAddress(BRIDGE), amount],
              chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
            },
            l1Client,
          );
          setDeployingStep(5);
          await sendTx(
            {
              address: getAddress(BRIDGE),
              abi: BRIDGE_ABI,
              functionName: 'bridgeERC20To',
              args: [
                getAddress(l1Addr),
                getAddress(l2Addr),
                getAddress(address),
                amount,
                200000,
                '0x',
              ],
              chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
            },
            l1Client,
          );
        }
        result = { l1Address: l1Addr, l2Address: l2Addr };
      }

      addToken({
        name: formData.name,
        symbol: formData.symbol,
        type: tokenType,
        maxSupply: (+formData.maxSupply).toLocaleString(),
        addressL1: result.l1Address,
        addressL2: result.l2Address,
      });
      setDeploymentResult(result);
      setDeployingStep(tokenType === 'celo-native' ? 3 : 7);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep('success');
    } catch (error: any) {
      console.error(error);
      setDeployError(error.message || 'Deployment failed');
      setStep('review');
    } finally {
      setIsDeploying(false);
    }
  }, [
    tokenType,
    address,
    walletClient,
    form,
    l1Client,
    l2Client,
    switchChainAsync,
    addToken,
    chainId,
  ]);

  const steps: CreateTokenStep[] = [
    'choose-type',
    'token-info',
    'review',
    'deploying',
    'success',
  ];
  const goToNextStep = useCallback(() => {
    const i = steps.indexOf(step);
    if (i < 4) setStep(steps[i + 1]);
  }, [step]);
  const goToPreviousStep = useCallback(() => {
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
  }, [step]);
  const reset = useCallback(() => {
    setTokenType(null);
    setStep('choose-type');
    setDeployingStep(0);
    setDeploymentResult(null);
    setIsDeploying(false);
    setDeployError(null);
    setIsSwitchingChain(false);
    form.reset(defaultTokenFormValues);
  }, [form]);

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
    isDeploying,
    deployError,
    startDeployment,
    hasResumableDeployment: false,
    resumeDeployment: async () => {},
    cancelResumableDeployment: () => {},
    reset,
    l1Factory: {
      isConnected: !!address,
      isCorrectChain: chainId === CONTRACTS.L1_TOKEN_FACTORY.chainId,
      isLoading: isDeploying,
    },
    l2Factory: {
      isConnected: !!address,
      isCorrectChain: chainId === CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
      isLoading: isDeploying,
    },
    isSwitchingChain,
  };
}
