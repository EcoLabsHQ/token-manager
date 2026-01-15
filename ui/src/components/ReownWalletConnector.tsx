import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

interface ReownWalletConnectorProps {
  address?: string | null;
}

export const ReownWalletConnector = ({ address }: ReownWalletConnectorProps) => {
  const { open } = useAppKit();
  const { address: connectedAddress, isConnected } = useAppKitAccount();
  
  const displayAddress = connectedAddress || address;

  if (isConnected && displayAddress) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <button
          onClick={() => open({ view: 'Account' })}
          className="px-2 md:px-3 py-2 hover:bg-emerald-500/20 rounded-lg transition-all text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium whitespace-nowrap"
          title="Manage Account"
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">{displayAddress.slice(0, 10)}...{displayAddress.slice(-8)}</span>
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => open()}
      className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-cyan-500/40 font-semibold py-5 md:py-6 text-xs md:text-base whitespace-nowrap"
    >
      <Wallet className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
      <span className="hidden sm:inline">Connect Wallet</span>
      <span className="sm:hidden">Connect</span>
    </Button>
  );
};
