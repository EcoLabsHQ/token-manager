import { useState, useCallback } from 'react';
import { PROMO_API_URL, CONTRACTS } from '@/config/contracts';

export interface PromoValidationResult {
  signature: string;
  promoFee: string;
  promoNonce: string;
  expiresAt: number;
  chainId: number;
  factoryAddress: string;
  signerAddress: string;
  code: string;
}

export interface PromoCheckResult {
  code: string;
  isValid: boolean;
  discountFee: string;
  expiresAt: number;
  remainingUses: number;
  reason?: string;
}

export function usePromoCode() {
  const [isValidating, setIsValidating] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoData, setPromoData] = useState<PromoValidationResult | null>(null);
  const [promoCode, setPromoCode] = useState('');

  const checkPromoCode = useCallback(async (code: string): Promise<PromoCheckResult | null> => {
    if (!code.trim()) return null;
    
    try {
      const res = await fetch(`${PROMO_API_URL}/api/promo/check/${encodeURIComponent(code)}`);
      const data = await res.json();
      
      if (!data.success) {
        return null;
      }
      
      return data.data as PromoCheckResult;
    } catch {
      return null;
    }
  }, []);

  const validatePromoCode = useCallback(async (
    code: string,
    userAddress: string,
    isL1: boolean
  ): Promise<PromoValidationResult | null> => {
    if (!code.trim()) {
      setPromoData(null);
      setPromoError(null);
      return null;
    }

    setIsValidating(true);
    setPromoError(null);

    try {
      const chainId = isL1 
        ? CONTRACTS.L1_TOKEN_FACTORY.chainId 
        : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
      const factoryAddress = isL1 
        ? CONTRACTS.L1_TOKEN_FACTORY.address 
        : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address;

      const res = await fetch(`${PROMO_API_URL}/api/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          userAddress,
          chainId,
          factoryAddress,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setPromoError(data.error || 'Invalid promo code');
        setPromoData(null);
        return null;
      }

      setPromoData(data.data);
      return data.data as PromoValidationResult;
    } catch (err: any) {
      setPromoError(err.message || 'Failed to validate promo code');
      setPromoData(null);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearPromo = useCallback(() => {
    setPromoCode('');
    setPromoData(null);
    setPromoError(null);
  }, []);

  return {
    promoCode,
    setPromoCode,
    promoData,
    promoError,
    isValidating,
    validatePromoCode,
    checkPromoCode,
    clearPromo,
  };
}
