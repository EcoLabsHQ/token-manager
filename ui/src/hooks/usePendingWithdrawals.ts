import { useState, useCallback, useEffect } from 'react';
import type { Hash } from 'viem';
import type { WithdrawalStatus } from './useWithdraw';

export interface PendingWithdrawalStorage {
  id: string;
  l2TxHash: Hash;
  l2TokenAddress: string;
  l1TokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  recipient: string;
  status: WithdrawalStatus;
  initiatedAt: number;
  provenAt?: number;
  finalizedAt?: number;
  proveTxHash?: Hash;
  finalizeTxHash?: Hash;
}

const STORAGE_KEY = 'pending_withdrawals';

function loadFromStorage(): PendingWithdrawalStorage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveToStorage(withdrawals: PendingWithdrawalStorage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withdrawals));
  } catch (err) {
    console.error('Failed to save withdrawals to storage:', err);
  }
}

export function usePendingWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawalStorage[]>([]);

  // Load from storage on mount
  useEffect(() => {
    setWithdrawals(loadFromStorage());
  }, []);

  // Add a new pending withdrawal
  const addWithdrawal = useCallback((withdrawal: Omit<PendingWithdrawalStorage, 'id'>) => {
    const newWithdrawal: PendingWithdrawalStorage = {
      ...withdrawal,
      id: `${withdrawal.l2TxHash}-${Date.now()}`,
    };
    
    setWithdrawals(prev => {
      // Check if already exists
      if (prev.some(w => w.l2TxHash === withdrawal.l2TxHash)) {
        return prev;
      }
      const updated = [...prev, newWithdrawal];
      saveToStorage(updated);
      return updated;
    });
    
    return newWithdrawal;
  }, []);

  // Update an existing withdrawal
  const updateWithdrawal = useCallback((l2TxHash: Hash, updates: Partial<PendingWithdrawalStorage>) => {
    setWithdrawals(prev => {
      const updated = prev.map(w => 
        w.l2TxHash === l2TxHash ? { ...w, ...updates } : w
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  // Remove a withdrawal (e.g., after finalization)
  const removeWithdrawal = useCallback((l2TxHash: Hash) => {
    setWithdrawals(prev => {
      const updated = prev.filter(w => w.l2TxHash !== l2TxHash);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  // Get withdrawals for a specific token
  const getWithdrawalsForToken = useCallback((l2TokenAddress: string) => {
    return withdrawals.filter(w => 
      w.l2TokenAddress.toLowerCase() === l2TokenAddress.toLowerCase()
    );
  }, [withdrawals]);

  // Get all non-finalized withdrawals
  const getPendingWithdrawals = useCallback(() => {
    return withdrawals.filter(w => w.status !== 'finalized');
  }, [withdrawals]);

  // Refresh from storage
  const refresh = useCallback(() => {
    setWithdrawals(loadFromStorage());
  }, []);

  return {
    withdrawals,
    addWithdrawal,
    updateWithdrawal,
    removeWithdrawal,
    getWithdrawalsForToken,
    getPendingWithdrawals,
    refresh,
  };
}
