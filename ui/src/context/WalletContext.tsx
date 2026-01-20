import { createContext, useContext } from 'react';
import { useAccount } from 'wagmi';

export interface WalletContextType {
  address: string | null;
  isConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const { address, isConnected } = useAccount();

  return (
    <WalletContext.Provider
      value={{
        address: address || null,
        isConnected,
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
