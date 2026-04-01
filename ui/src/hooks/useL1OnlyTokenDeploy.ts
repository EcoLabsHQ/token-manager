import { useCallback, useState } from 'react';
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
  decodeEventLog,
  keccak256,
  toBytes,
  type TransactionReceipt,
} from 'viem';
import {
  CONTRACTS,
  L1_TOKEN_FACTORY_ABI,
} from '@/config/contracts';
import { pinMetadataOnly, type TokenMetadata } from '@/lib/metadata';
import { useTokenLogo } from './useTokenLogo';
import type { PromoValidationResult } from './usePromoCode';

export interface L1OnlyTokenParams {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
  tokenLogo?: string;
}

export type L1OnlyStep = 'idle' | 'uploading' | 'creating' | 'success' | 'error';

const extractToken = (r: TransactionReceipt, abi: any): string | null => {
  for (const log of r.logs) {
    try {
      const d = decodeEventLog({ abi, data: log.data, topics: log.topics }) as {
        eventName: string;
        args: { tokenAddress: string };
      };
      if (d.eventName === 'TokenCreated') return d.args.tokenAddress;
    } catch {
      // Not a matching event
    }
  }
  return null;
};

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

export function useL1OnlyTokenDeploy() {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const { data: walletClient } = useWalletClient();
  const l1Client = usePublicClient({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
  const { switchChainAsync } = useSwitchChain();
  const { preUploadLogo, copyLogoToTokenAddress } = useTokenLogo();

  const [currentStep, setCurrentStep] = useState<L1OnlyStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  // Read creation fee from L1 factory
  const { data: creationFee } = useReadContract({
    address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
    abi: L1_TOKEN_FACTORY_ABI,
    functionName: 'creationFee',
    chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId,
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

  const deploy = useCallback(
    async (params: L1OnlyTokenParams, promoData?: PromoValidationResult | null) => {
      if (!address) {
        setError('Please connect your wallet');
        return;
      }
      if (!walletClient) {
        setError('Wallet not ready');
        return;
      }

      setError(null);
      setTokenAddress(null);
      setCurrentStep('uploading');

      try {
        const targetChainId = CONTRACTS.L1_TOKEN_FACTORY.chainId;
        let metadataURI = '';

        // Generate unique hash for image upload
        const imageHash = keccak256(toBytes(`${params.name}-${params.symbol}-${address}-${targetChainId}`));
        const imageIdentifier = imageHash.slice(2, 18);

        // Upload image to CDN
        let imageUrl: string | undefined;
        if (params.tokenLogo) {
          try {
            const file = dataURLtoFile(params.tokenLogo, `${params.symbol}-logo.png`);
            const uploadResult = await preUploadLogo(targetChainId, imageIdentifier, file);
            imageUrl = uploadResult.url;
          } catch (logoError) {
            console.warn('Failed to upload image:', logoError);
          }
        }

        // Pin metadata to IPFS
        try {
          const metadata: TokenMetadata = {
            name: params.name,
            symbol: params.symbol,
            decimals: params.decimals,
            image: imageUrl,
            properties: {
              maxSupply: params.maxSupply,
              initialSupply: params.initialSupply,
              creator: address,
              chainId: targetChainId,
            },
          };
          const pinResult = await pinMetadataOnly(metadata);
          if (pinResult.success && pinResult.data) {
            metadataURI = pinResult.data.metadataURI;
          }
        } catch (metadataError) {
          console.warn('Error pinning metadata:', metadataError);
        }

        // Create L1 token
        setCurrentStep('creating');

        const txParams = promoData
          ? {
              address: getAddress(CONTRACTS.L1_TOKEN_FACTORY.address),
              abi: L1_TOKEN_FACTORY_ABI,
              functionName: 'createTokenWithPromo' as const,
              args: [
                getAddress(address),
                params.name,
                params.symbol,
                params.decimals,
                parseUnits(params.initialSupply, params.decimals),
                parseUnits(params.maxSupply, params.decimals),
                metadataURI,
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
                params.name,
                params.symbol,
                params.decimals,
                parseUnits(params.initialSupply, params.decimals),
                parseUnits(params.maxSupply, params.decimals),
                metadataURI,
              ],
              value: creationFee ?? 0n,
              chain: { id: CONTRACTS.L1_TOKEN_FACTORY.chainId } as any,
            };

        const receipt = await sendTx(txParams, l1Client);
        const l1Addr = extractToken(receipt, L1_TOKEN_FACTORY_ABI);

        if (!l1Addr) {
          throw new Error('Failed to extract token address from transaction');
        }

        // Copy image to real token address
        if (params.tokenLogo && imageIdentifier) {
          try {
            await copyLogoToTokenAddress(targetChainId, l1Addr, imageIdentifier);
          } catch (logoError) {
            console.warn('Failed to copy logo:', logoError);
          }
        }

        setTokenAddress(getAddress(l1Addr));
        setCurrentStep('success');
      } catch (err: any) {
        console.error('L1-only deployment failed:', err);
        setError(err.message || 'Deployment failed');
        setCurrentStep('error');
      }
    },
    [address, walletClient, l1Client, switchChainAsync, creationFee, config, chainId, preUploadLogo, copyLogoToTokenAddress],
  );

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setError(null);
    setTokenAddress(null);
    setIsSwitchingChain(false);
  }, []);

  return {
    deploy,
    reset,
    currentStep,
    error,
    tokenAddress,
    creationFee: creationFee ?? 0n,
    isSwitchingChain,
    isLoading: currentStep === 'uploading' || currentStep === 'creating',
  };
}
