import { useState, useCallback } from 'react';
import { pinTokenMetadata, type TokenMetadata } from '@/lib/metadata';
import type { MetadataUpdateFormData } from '@/lib/schemas/token';
import type { TransactionResult } from './useTokenManager';

// ─── Step type ────────────────────────────────────────────────────────────────

export type MetadataUpdateStep =
  | 'idle'
  | 'pinning'    // uploading image + JSON to IPFS
  | 'updating'   // sending setMetadataURI tx
  | 'success'
  | 'error';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface UseUpdateMetadataOptions {
  /** ERC-20 token name (immutable – used to build the metadata JSON) */
  name: string;
  /** ERC-20 token symbol (immutable – used to build the metadata JSON) */
  symbol: string;
  /** Token decimals (immutable – stored inside properties) */
  decimals: number;
  /** Current on-chain metadata URI, used to pre-fill the form */
  currentMetadataURI?: string;
  /** Bound `updateMetadataURI` from `useTokenManager` */
  updateMetadataURIFn: (uri: string) => Promise<TransactionResult>;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseUpdateMetadataReturn {
  /** Execute the full update flow with the given form data + optional image */
  update: (
    formData: MetadataUpdateFormData,
    imageFile?: File,
    /** Properties from the original metadata that must be preserved (immutable / managed elsewhere) */
    preservedProperties?: Record<string, unknown>,
  ) => Promise<void>;
  /** Reset the hook to idle state */
  reset: () => void;
  step: MetadataUpdateStep;
  error: string | null;
  newMetadataURI: string | null;
  txHash: string | null;
  isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUpdateMetadata({
  name,
  symbol,
  decimals,
  updateMetadataURIFn,
}: UseUpdateMetadataOptions): UseUpdateMetadataReturn {
  const [step, setStep] = useState<MetadataUpdateStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [newMetadataURI, setNewMetadataURI] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Full update flow: IPFS pin → contract tx
  const update = useCallback(
    async (
      formData: MetadataUpdateFormData,
      imageFile?: File,
      preservedProperties?: Record<string, unknown>,
    ): Promise<void> => {
      setStep('pinning');
      setError(null);
      setNewMetadataURI(null);
      setTxHash(null);

      try {
        // Start from the preserved (immutable) properties, then layer editable fields on top
        const properties: TokenMetadata['properties'] = {
          ...preservedProperties,
          // Always keep decimals in sync
          decimals,
        };
        if (formData.website)          properties.website          = formData.website;
        if (formData.email)            properties.email            = formData.email;
        if (formData.category)         properties.category         = formData.category;
        if (formData.social_twitter)   properties.social_twitter   = formData.social_twitter;
        if (formData.social_discord)   properties.social_discord   = formData.social_discord;
        if (formData.social_telegram)  properties.social_telegram  = formData.social_telegram;
        if (formData.tags)             properties.tags             = formData.tags;

        // Build the ERC-7572 metadata object
        const metadata: Omit<TokenMetadata, 'image'> = {
          name,
          symbol,
          decimals,
          ...(formData.description  ? { description:   formData.description }  : {}),
          ...(formData.external_link ? { external_link: formData.external_link } : {}),
          properties,
        };

        // Pin to IPFS (image is optional — backend handles both cases)
        const pinResult = await pinTokenMetadata(metadata, imageFile);

        if (!pinResult.success || !pinResult.data) {
          throw new Error(pinResult.error ?? 'Failed to pin metadata to IPFS');
        }

        const uri = pinResult.data.metadataURI;
        setNewMetadataURI(uri);

        // Call setMetadataURI on the contract
        setStep('updating');
        const txResult = await updateMetadataURIFn(uri);

        if (!txResult.success) {
          throw new Error(txResult.error ?? 'Contract transaction failed');
        }

        setTxHash(txResult.txHash ?? null);
        setStep('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStep('error');
      }
    },
    [name, symbol, decimals, updateMetadataURIFn]
  );

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setNewMetadataURI(null);
    setTxHash(null);
  }, []);

  return {
    update,
    reset,
    step,
    error,
    newMetadataURI,
    txHash,
    isLoading: step === 'pinning' || step === 'updating',
  };
}
