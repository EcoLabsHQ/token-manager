import { createContext, useContext, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

export interface Token {
  id: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  maxSupply: string;
  owner: string;
  createdAt: string;
}

export interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  tokens: Token[];
  addToken: (token: Token) => void;
  removeToken: (id: string) => void;
  updateToken: (id: string, token: Token) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  // Get wallet address from Wagmi
  const { address, isConnected } = useAccount();
  
  const [tokens, setTokens] = useState<Token[]>(() => {
    const stored = localStorage.getItem('hvt_tokens');
    return stored ? JSON.parse(stored) : [];
  });

  // Sync wallet address from Wagmi hook
  useEffect(() => {
    console.log('Wallet connected:', { address, isConnected });
  }, [address, isConnected]);

  const addToken = (token: Token) => {
    setTokens((prev) => {
      const updated = [...prev, token];
      localStorage.setItem('hvt_tokens', JSON.stringify(updated));
      return updated;
    });
  };

  const removeToken = (id: string) => {
    setTokens((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem('hvt_tokens', JSON.stringify(updated));
      return updated;
    });
  };

  const updateToken = (id: string, token: Token) => {
    setTokens((prev) => {
      const updated = prev.map((t) => (t.id === id ? token : t));
      localStorage.setItem('hvt_tokens', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <WalletContext.Provider
      value={{
        address: address || null,
        isConnected,
        tokens,
        addToken,
        removeToken,
        updateToken,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
