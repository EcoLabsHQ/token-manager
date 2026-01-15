import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';

export const useReownWallet = () => {
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { address: contextAddress } = useWallet();

  useEffect(() => {
    if (address && isConnected) {
      // Update context with Reown address if available
      if (address !== contextAddress) {
        // You can dispatch an action to update context if needed
        console.log('Connected address from Reown:', address);
      }
    }
  }, [address, isConnected, contextAddress]);

  return {
    address: address || contextAddress,
    isConnected,
    chainId,
  };
};
