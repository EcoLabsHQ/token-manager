import { AppKitButton } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

export const ReownConnectButton = () => {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (address || isConnected)) {
      console.log('✅ Wallet Connected:', { address, isConnected });
    }
  }, [address, isConnected, mounted]);

  return (
    <div className="shrink-0">
      <AppKitButton />
    </div>
  );
};
