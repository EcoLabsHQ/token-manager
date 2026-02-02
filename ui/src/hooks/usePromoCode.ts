import { useState, useCallback, useEffect, useRef } from 'react';
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

export type PromoStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export function usePromoCode(chainId?: number) {
  const [isValidating, setIsValidating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoData, setPromoData] = useState<PromoValidationResult | null>(null);
  const [promoCode, setPromoCodeState] = useState('');
  const [promoStatus, setPromoStatus] = useState<PromoStatus>('idle');
  const [checkResult, setCheckResult] = useState<PromoCheckResult | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced check when promo code changes
  const setPromoCode = useCallback((code: string) => {
    const upperCode = code.toUpperCase();
    setPromoCodeState(upperCode);
    
    // Clear previous state
    setPromoError(null);
    setCheckResult(null);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (!upperCode.trim()) {
      setPromoStatus('idle');
      return;
    }
    
    setPromoStatus('checking');
    setIsChecking(true);
    
    // Debounce the check
    debounceRef.current = setTimeout(async () => {
      try {
        abortControllerRef.current = new AbortController();
        
        const queryParams = chainId ? `?chainId=${chainId}` : '';
        const res = await fetch(
          `${PROMO_API_URL}/api/promo/check/${encodeURIComponent(upperCode)}${queryParams}`,
          { signal: abortControllerRef.current.signal }
        );
        const data = await res.json();
        
        if (!data.success) {
          setPromoStatus('invalid');
          setPromoError(data.error || 'Invalid promo code');
          setCheckResult(null);
        } else if (!data.data.isValid) {
          setPromoStatus('invalid');
          const reason = data.data.reason;
          setPromoError(
            reason === 'expired' ? 'Promo code has expired' :
            reason === 'exhausted' ? 'Promo code has been fully used' :
            reason === 'inactive' ? 'Promo code is inactive' :
            'Invalid promo code'
          );
          setCheckResult(data.data);
        } else {
          setPromoStatus('valid');
          setPromoError(null);
          setCheckResult(data.data);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setPromoStatus('error');
        setPromoError('Failed to check promo code');
      } finally {
        setIsChecking(false);
      }
    }, 500); // 500ms debounce
  }, [chainId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
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
      const targetChainId = isL1 
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
          chainId: targetChainId,
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
    setPromoCodeState('');
    setPromoData(null);
    setPromoError(null);
    setPromoStatus('idle');
    setCheckResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  return {
    promoCode,
    setPromoCode,
    promoData,
    promoError,
    promoStatus,
    checkResult,
    isValidating,
    isChecking,
    validatePromoCode,
    clearPromo,
  };
}
