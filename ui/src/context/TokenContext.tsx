import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Token, TokenFormData, TokenType } from '../types';

interface TokenContextValue {
  tokens: Token[];
  addToken: (formData: TokenFormData, tokenType: TokenType) => Token;
  getToken: (id: string) => Token | undefined;
}

const TokenContext = createContext<TokenContextValue | null>(null);

// Mock initial tokens
const initialTokens: Token[] = [
  {
    id: '1',
    name: 'Kolektivo Guilder',
    symbol: 'KTG',
    type: 'ethereum-enabled',
    initialSupply: '1000000',
    maxSupply: '10000000',
    decimals: 18,
    l1Address: '0x1234...abcd',
    l2Address: '0x5678...efgh',
    createdAt: new Date('2025-01-15'),
  },
  {
    id: '2',
    name: 'Test Token',
    symbol: 'TST',
    type: 'celo-native',
    initialSupply: '500000',
    maxSupply: '5000000',
    decimals: 18,
    l2Address: '0x9abc...1234',
    createdAt: new Date('2025-01-20'),
  },
];

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens);

  const addToken = useCallback((formData: TokenFormData, tokenType: TokenType): Token => {
    const newToken: Token = {
      id: Date.now().toString(),
      name: formData.name,
      symbol: formData.symbol,
      type: tokenType,
      initialSupply: formData.initialSupply,
      maxSupply: formData.maxSupply,
      decimals: formData.decimals,
      l1Address: tokenType === 'ethereum-enabled' ? '0x1234...abcd' : undefined,
      l2Address: '0x5678...efgh',
      createdAt: new Date(),
    };

    setTokens((prev) => [newToken, ...prev]);
    return newToken;
  }, []);

  const getToken = useCallback((id: string) => {
    return tokens.find((token) => token.id === id);
  }, [tokens]);

  return (
    <TokenContext.Provider value={{ tokens, addToken, getToken }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokens must be used within a TokenProvider');
  }
  return context;
}
