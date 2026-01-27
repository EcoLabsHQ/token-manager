import { useState, useCallback, useEffect } from 'react';

export interface Token {
  id: string;
  name: string;
  symbol: string;
  type: 'ethereum-enabled' | 'celo-native';
  maxSupply: string;
  addressL1?: string;
  addressL2?: string;
  createdAt?: Date;
}

const STORAGE_KEY = 'celo-token-manager-tokens';

// Mock initial tokens
const initialTokens: Token[] = [
  {
    id: '1',
    name: 'Kolektivo',
    symbol: 'KOL',
    type: 'ethereum-enabled',
    maxSupply: '10,000,000',
    addressL1: '0x758D...FAB0',
    addressL2: '0x4r34...35C5',
  },
  {
    id: '2',
    name: 'Satoshi',
    symbol: 'SAT',
    type: 'celo-native',
    maxSupply: '1,000,000',
    addressL2: '0x5e67...64B8',
  },
];

function loadTokensFromStorage(): Token[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading tokens from storage:', error);
  }
  return initialTokens;
}

function saveTokensToStorage(tokens: Token[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error('Error saving tokens to storage:', error);
  }
}

export function useTokenStorage() {
  const [tokens, setTokens] = useState<Token[]>(() => loadTokensFromStorage());

  // Sync to localStorage whenever tokens change
  useEffect(() => {
    saveTokensToStorage(tokens);
  }, [tokens]);

  const addToken = useCallback((token: Omit<Token, 'id'>) => {
    const newToken: Token = {
      ...token,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setTokens((prev) => [newToken, ...prev]);
    return newToken;
  }, []);

  const removeToken = useCallback((id: string) => {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getToken = useCallback((id: string) => {
    return tokens.find((t) => t.id === id);
  }, [tokens]);

  const resetTokens = useCallback(() => {
    setTokens(initialTokens);
  }, []);

  return {
    tokens,
    addToken,
    removeToken,
    getToken,
    resetTokens,
  };
}
