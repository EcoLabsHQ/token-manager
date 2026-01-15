import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { useEffect, useState } from 'react';

export const useWalletConnection = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    address: mounted ? address : undefined,
    isConnected: mounted ? isConnected : false,
    chainId: mounted ? chainId : undefined,
    connect,
    disconnect,
    connectors,
    isPending,
    isMounted: mounted,
  };
};
