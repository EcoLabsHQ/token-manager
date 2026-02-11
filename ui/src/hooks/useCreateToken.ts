import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
  useReadContract,
  useConfig,
} from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import {
  parseUnits,
  getAddress,
  toHex,
  keccak256,
  decodeEventLog,
  type TransactionReceipt,
} from 'viem';
import {
  tokenFormSchema,
  defaultTokenFormValues,
  type TokenFormData,
  type TokenType,
} from '../lib/schemas';
import { useTokenStorage } from './useTokenStorage';
import { usePromoCode, type PromoValidationResult } from './usePromoCode';
import { useTokenLogo } from './useTokenLogo';
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

// Resumable deployment state stored in localStorage
const DEPLOYMENT_STORAGE_KEY = 'ecolabs_pending_deployment';

// Form data without tokenLogo (too large for localStorage)
interface StorableFormData {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
}

interface PendingDeployment {
  tokenType: TokenType;
  formData: StorableFormData;
  salt: string;
  currentStep: number;
  l1Address?: string;
  l2Address?: string;
  promoData?: PromoValidationResult | null;
  createdAt: number;
}

// Helper to convert base64 data URL to File
const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// L1 chain ID for bridge operations
const L1_CHAIN_ID = CONTRACTS.L1_TOKEN_FACTORY.chainId;
const L2_BRIDGE = '0x4200000000000000000000000000000000000010';
const L1_BRIDGE = '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe';

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

const extractToken = (r: TransactionReceipt, abi: any): string | null => {
  console.log('Extracting token from receipt, logs count:', r.logs.length);
  console.debug(r);
  for (const log of r.logs) {
    try {
      const d = decodeEventLog({ abi, data: log.data, topics: log.topics }) as {
        eventName: string;
        args: { tokenAddress: string };
      };

      console.debug(d);
      console.log('Decoded event:', d.eventName, d.args);
      if (d.eventName === 'TokenCreated') return d.args.tokenAddress;
    } catch (e) {
      // Not a matching event, continue
    }
  }
  console.log('No TokenCreated event found in logs');
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
  const [pendingDeployment, setPendingDeployment] =
    useState<PendingDeployment | null>(null);

  const { address, chainId } = useAccount();
  const config = useConfig();
  const { data: walletClient } = useWalletClient();
  const l1Client = usePublicClient({
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  });
  const l2Client = usePublicClient({
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
  });
  const { switchChainAsync } = useSwitchChain();
  const { addToken } = useTokenStorage();
  const { uploadLogo } = useTokenLogo();

  // Load pending deployment from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
      console.log('Checking for pending deployment:', saved ? 'found' : 'none');
      if (saved) {
        const parsed = JSON.parse(saved) as PendingDeployment;
        // Only restore if less than 24 hours old
        if (Date.now() - parsed.createdAt < 24 * 60 * 60 * 1000) {
          console.log('Loaded pending deployment:', {
            step: parsed.currentStep,
            l1: parsed.l1Address,
            l2: parsed.l2Address,
            tokenType: parsed.tokenType,
          });
          setPendingDeployment(parsed);
        } else {
          console.log('Pending deployment expired, removing');
          localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to load pending deployment:', e);
      localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
    }
  }, []);

  // Save deployment state to localStorage
  const saveDeploymentState = useCallback((state: PendingDeployment) => {
    try {
      const stateToSave = {
        ...state,
        // Ensure formData doesn't have tokenLogo
        formData: {
          name: state.formData.name,
          symbol: state.formData.symbol,
          initialSupply: state.formData.initialSupply,
          maxSupply: state.formData.maxSupply,
          decimals: state.formData.decimals,
        },
      };
      const serialized = JSON.stringify(stateToSave);
      localStorage.setItem(DEPLOYMENT_STORAGE_KEY, serialized);
      setPendingDeployment(stateToSave);
      console.log('Saved deployment state:', {
        step: state.currentStep,
        l1: state.l1Address,
        l2: state.l2Address,
      });
    } catch (e) {
      console.error('Failed to save deployment state:', e);
    }
  }, []);

  // Clear pending deployment
  const clearPendingDeployment = useCallback(() => {
    localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
    setPendingDeployment(null);
  }, []);

  // Determine which chain we'll deploy to based on token type
  const deployChainId =
    tokenType === 'ethereum-enabled'
      ? CONTRACTS.L1_TOKEN_FACTORY.chainId
      : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;

  const promo = usePromoCode(deployChainId);

  // Read creationFee from factories
  const { data: l1CreationFee } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'creationFee',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
  });

  const { data: l2CreationFee } = useReadContract({
    address: getAddress(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address),
    abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
    functionName: 'creationFee',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
  });
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
        await new Promise((resolve) => setTimeout(resolve, 500));
      } finally {
        setIsSwitchingChain(false);
      }
    }
    // Get fresh wallet client after chain switch to ensure correct chain
    const freshWalletClient = await getWalletClient(config, {
      chainId: targetChainId || chainId,
    });
    if (!freshWalletClient) {
      throw new Error('Failed to get wallet client');
    }
    const hash = await freshWalletClient.writeContract(params);
    const receipt = await publicClient!.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 120_000,
    });
    if (receipt.status === 'reverted') throw new Error('Transaction reverted');
    return receipt;
  };

  const startDeployment = useCallback(
    async (promoData?: PromoValidationResult | null) => {
      if (!tokenType) {
        setDeployError('Please select a token type');
        return;
      }
      if (!address) {
        setDeployError('Please connect your wallet');
        return;
      }
      if (!walletClient) {
        setDeployError('Wallet not ready');
        return;
      }
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
        const salt = keccak256(
          toHex(`${address}-${formData.name}-${formData.symbol}-${Date.now()}`),
        );

        // Save initial deployment state (exclude tokenLogo - too large for localStorage)
        const deploymentState: PendingDeployment = {
          tokenType,
          formData: {
            name: formData.name,
            symbol: formData.symbol,
            initialSupply: formData.initialSupply,
            maxSupply: formData.maxSupply,
            decimals: formData.decimals,
          },
          salt,
          currentStep: 0,
          promoData,
          createdAt: Date.now(),
        };
        saveDeploymentState(deploymentState);

        if (tokenType === 'celo-native') {
          setDeployingStep(1);
          deploymentState.currentStep = 1;
          saveDeploymentState(deploymentState);

          // Use promo if available
          const txParams = promoData
            ? {
                address: getAddress(
                  CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
                ),
                abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
                functionName: 'createTokenWithPromo' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                  BigInt(promoData.promoFee),
                  promoData.promoNonce as `0x${string}`,
                  BigInt(promoData.expiresAt),
                  promoData.signature as `0x${string}`,
                ],
                value: BigInt(promoData.promoFee),
                chain: {
                  id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
                } as any,
              }
            : {
                address: getAddress(
                  CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
                ),
                abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
                functionName: 'createToken' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                ],
                value: l2CreationFee ?? 0n,
                chain: {
                  id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
                } as any,
              };

          const receipt = await sendTx(txParams, l2Client);
          const l2Addr = extractToken(
            receipt,
            L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          )!;
          result = { l2Address: l2Addr };
        } else {
          setDeployingStep(1);

          // Use promo for L1 if available
          const l1TxParams = promoData
            ? {
                address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
                abi: L1_TOKEN_FACTORY_ABI,
                functionName: 'createTokenWithPromo' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                  BigInt(promoData.promoFee),
                  promoData.promoNonce as `0x${string}`,
                  BigInt(promoData.expiresAt),
                  promoData.signature as `0x${string}`,
                ],
                value: BigInt(promoData.promoFee),
                chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
              }
            : {
                address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
                abi: L1_TOKEN_FACTORY_ABI,
                functionName: 'createToken' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                ],
                value: l1CreationFee ?? 0n,
                chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
              };

          const l1Receipt = await sendTx(l1TxParams, l1Client);
          const l1Addr = extractToken(l1Receipt, L1_TOKEN_FACTORY_ABI)!;

          // Save L1 address after successful deployment
          deploymentState.l1Address = l1Addr;
          deploymentState.currentStep = 2;
          saveDeploymentState(deploymentState);

          setDeployingStep(2);
          // Use createTokenWithBridge for L2 - NO FEE (already paid on L1)
          // This function also sets bridge and remoteToken automatically
          const l2Receipt = await sendTx(
            {
              address: getAddress(
                CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
              ),
              abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
              functionName: 'createTokenWithBridge',
              args: [
                getAddress(address),
                formData.name,
                formData.symbol,
                formData.decimals,
                parseUnits(formData.initialSupply, formData.decimals),
                parseUnits(formData.maxSupply, formData.decimals),
                getAddress(L2_BRIDGE),
                getAddress(l1Addr),
                salt,
              ],
              chain: {
                id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
              } as any,
            },
            l2Client,
          );
          const l2Addr = extractToken(
            l2Receipt,
            L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          );

          if (!l2Addr) {
            console.error(
              'Failed to extract L2 token address from receipt:',
              l2Receipt,
            );
            throw new Error('Failed to get L2 token address from transaction');
          }

          console.log('L2 token created:', l2Addr);

          // Save L2 address after successful deployment
          deploymentState.l2Address = l2Addr;
          deploymentState.currentStep = 3;
          saveDeploymentState(deploymentState);

          // Bridge and remoteToken are already configured by createTokenWithBridge
          setDeployingStep(3);

          if (+formData.initialSupply > 0) {
            setDeployingStep(4);
            deploymentState.currentStep = 4;
            saveDeploymentState(deploymentState);

            const amount = parseUnits(formData.initialSupply, 18);

            console.log('Bridge params:', { l1Token: l1Addr, l2Token: l2Addr, amount: amount.toString() });

            // Step 4: Approve bridge to spend tokens
            await sendTx(
              {
                address: getAddress(l1Addr),
                abi: APPROVE_ABI,
                functionName: 'approve',
                args: [getAddress(L1_BRIDGE), amount],
                chain: { id: L1_CHAIN_ID } as any,
              },
              l1Client,
            );

            setDeployingStep(5);
            deploymentState.currentStep = 5;
            saveDeploymentState(deploymentState);

            // Step 5: Bridge tokens using bridgeERC20To directly
            await sendTx(
              {
                address: getAddress(L1_BRIDGE),
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
                chain: { id: L1_CHAIN_ID } as any,
              },
              l1Client,
            );

            console.log('Bridge deposit completed');
          }
          result = { l1Address: l1Addr, l2Address: l2Addr };
        }

        // Upload token logo if provided (fire and forget - don't block success)
        if (formData.tokenLogo) {
          try {
            const file = dataURLtoFile(
              formData.tokenLogo,
              `${formData.symbol.toLowerCase()}-logo.png`,
            );

            // Upload for L2 address (always exists)
            await uploadLogo(
              CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
              result.l2Address,
              file,
            );

            // If ethereum-enabled, also upload for L1 address
            if (result.l1Address) {
              await uploadLogo(
                CONTRACTS.L1_TOKEN_FACTORY.chainId,
                result.l1Address,
                file,
              );
            }
          } catch (logoError) {
            // Don't fail the deployment if logo upload fails
            console.warn('Failed to upload token logo:', logoError);
          }
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

        // Clear pending deployment on success
        clearPendingDeployment();

        await new Promise((resolve) => setTimeout(resolve, 1000));
        setStep('success');
      } catch (error: any) {
        console.error(error);
        setDeployError(error.message || 'Deployment failed');
        // Keep the pending deployment in localStorage so user can retry
        setStep('review');
      } finally {
        setIsDeploying(false);
      }
    },
    [
      tokenType,
      address,
      walletClient,
      form,
      l1Client,
      l2Client,
      switchChainAsync,
      addToken,
      uploadLogo,
      chainId,
      saveDeploymentState,
      clearPendingDeployment,
    ],
  );

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
    promo.clearPromo();
    clearPendingDeployment();
  }, [form, promo, clearPendingDeployment]);

  // Resume a pending deployment from localStorage
  const resumeDeployment = useCallback(async () => {
    if (!pendingDeployment || !address || !walletClient) {
      setDeployError('Cannot resume: missing data or wallet not connected');
      return;
    }

    const {
      tokenType: savedTokenType,
      formData,
      salt,
      currentStep,
      l1Address,
      l2Address,
      promoData,
    } = pendingDeployment;

    // Restore state
    setTokenType(savedTokenType);
    form.reset(formData);
    setIsDeploying(true);
    setDeployError(null);
    setStep('deploying');

    setDeployingStep(currentStep > 0 ? currentStep : 1);

    try {
      let result: DeploymentResult;

      if (savedTokenType === 'celo-native') {
        // For celo-native, if we have l2Address we're done
        if (l2Address) {
          result = { l2Address };
        } else {
          // Need to deploy L2 token
          setDeployingStep(1);
          const txParams = promoData
            ? {
                address: getAddress(
                  CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
                ),
                abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
                functionName: 'createTokenWithPromo' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                  BigInt(promoData.promoFee),
                  promoData.promoNonce as `0x${string}`,
                  BigInt(promoData.expiresAt),
                  promoData.signature as `0x${string}`,
                ],
                value: BigInt(promoData.promoFee),
                chain: {
                  id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
                } as any,
              }
            : {
                address: getAddress(
                  CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
                ),
                abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
                functionName: 'createToken' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                ],
                value: l2CreationFee ?? 0n,
                chain: {
                  id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
                } as any,
              };

          const receipt = await sendTx(txParams, l2Client);
          const l2Addr = extractToken(
            receipt,
            L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          )!;
          result = { l2Address: l2Addr };
        }
      } else {
        // ethereum-enabled flow - resume from where we left off
        let l1Addr = l1Address;
        let l2Addr = l2Address;

        // Step 1: Create L1 token (if not done)
        if (!l1Addr) {
          setDeployingStep(1);
          const l1TxParams = promoData
            ? {
                address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
                abi: L1_TOKEN_FACTORY_ABI,
                functionName: 'createTokenWithPromo' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                  BigInt(promoData.promoFee),
                  promoData.promoNonce as `0x${string}`,
                  BigInt(promoData.expiresAt),
                  promoData.signature as `0x${string}`,
                ],
                value: BigInt(promoData.promoFee),
                chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
              }
            : {
                address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
                abi: L1_TOKEN_FACTORY_ABI,
                functionName: 'createToken' as const,
                args: [
                  getAddress(address),
                  formData.name,
                  formData.symbol,
                  formData.decimals,
                  parseUnits(formData.initialSupply, formData.decimals),
                  parseUnits(formData.maxSupply, formData.decimals),
                  salt,
                ],
                value: l1CreationFee ?? 0n,
                chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
              };

          const l1Receipt = await sendTx(l1TxParams, l1Client);
          l1Addr = extractToken(l1Receipt, L1_TOKEN_FACTORY_ABI)!;

          // Save progress
          pendingDeployment.l1Address = l1Addr;
          pendingDeployment.currentStep = 2;
          saveDeploymentState(pendingDeployment);
        }

        // Step 2: Create L2 token with bridge (if not done)
        if (!l2Addr && l1Addr) {
          setDeployingStep(2);
          const l2Receipt = await sendTx(
            {
              address: getAddress(
                CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address,
              ),
              abi: L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
              functionName: 'createTokenWithBridge',
              args: [
                getAddress(address),
                formData.name,
                formData.symbol,
                formData.decimals,
                parseUnits(formData.initialSupply, formData.decimals),
                parseUnits(formData.maxSupply, formData.decimals),
                getAddress(L2_BRIDGE),
                getAddress(l1Addr),
                salt,
              ],
              chain: {
                id: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
              } as any,
            },
            l2Client,
          );
          const extractedL2 = extractToken(
            l2Receipt,
            L2_SUPERCHAIN_TOKEN_FACTORY_ABI,
          );

          if (!extractedL2) {
            console.error(
              'Failed to extract L2 token address from receipt:',
              l2Receipt,
            );
            throw new Error('Failed to get L2 token address from transaction');
          }

          l2Addr = extractedL2;
          console.log('Resume: L2 token created:', l2Addr);

          // Save progress
          pendingDeployment.l2Address = l2Addr;
          pendingDeployment.currentStep = 3;
          saveDeploymentState(pendingDeployment);
        }

        // Step 4-5: Bridge initial supply (if needed and not done)
        if (+formData.initialSupply > 0 && l1Addr && l2Addr) {
          const amount = parseUnits(formData.initialSupply, 18);

          // Step 4: Approve bridge (if not done)
          if (currentStep < 4) {
            setDeployingStep(4);
            console.log('Resuming: Approving tokens for bridge...');

            await sendTx(
              {
                address: getAddress(l1Addr),
                abi: APPROVE_ABI,
                functionName: 'approve',
                args: [getAddress(L1_BRIDGE), amount],
                chain: { id: L1_CHAIN_ID } as any,
              },
              l1Client,
            );
            pendingDeployment.currentStep = 4;
            saveDeploymentState(pendingDeployment);
          }

          // Step 5: Bridge tokens (if not done)
          if (currentStep < 5) {
            setDeployingStep(5);
            console.log('Resuming: Bridging tokens to L2...');

            pendingDeployment.currentStep = 5;
            saveDeploymentState(pendingDeployment);

            console.debug(l1Addr, l2Addr, address);

            // Use bridgeERC20To directly
            await sendTx(
              {
                address: getAddress(L1_BRIDGE),
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
                chain: { id: L1_CHAIN_ID } as any,
              },
              l1Client,
            );

            console.log('Bridge deposit completed');
          }
        } else {
          // No bridge needed, mark as step 3
          setDeployingStep(3);
        }

        if (!l2Addr) {
          throw new Error('L2 token address not available');
        }

        result = { l1Address: l1Addr, l2Address: l2Addr };
      }

      // Note: tokenLogo is not stored in localStorage (too large), so we skip logo upload on resume
      // Users can upload the logo later from the token management page

      addToken({
        name: formData.name,
        symbol: formData.symbol,
        type: savedTokenType,
        maxSupply: (+formData.maxSupply).toLocaleString(),
        addressL1: result.l1Address,
        addressL2: result.l2Address,
      });
      setDeploymentResult(result);
      setDeployingStep(5);
      clearPendingDeployment();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep('success');
    } catch (error: any) {
      console.error(error);
      setDeployError(error.message || 'Resume failed');
      setStep('review');
    } finally {
      setIsDeploying(false);
    }
  }, [
    pendingDeployment,
    address,
    walletClient,
    form,
    l1Client,
    l2Client,
    switchChainAsync,
    addToken,
    uploadLogo,
    saveDeploymentState,
    clearPendingDeployment,
    l1CreationFee,
    l2CreationFee,
  ]);

  const cancelResumableDeployment = useCallback(() => {
    clearPendingDeployment();
  }, [clearPendingDeployment]);

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
    hasResumableDeployment: !!pendingDeployment,
    pendingDeployment,
    resumeDeployment,
    cancelResumableDeployment,
    reset,
    promo,
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
    l1CreationFee: l1CreationFee ?? 0n,
    l2CreationFee: l2CreationFee ?? 0n,
  };
}
