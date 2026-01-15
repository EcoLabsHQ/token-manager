import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LogOut, Wallet, Zap } from 'lucide-react';

interface WalletConnectorProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  address?: string | null;
}

export const WalletConnector = ({
  onConnect,
  onDisconnect,
  address = null,
}: WalletConnectorProps) => {
  const [localAddress, setLocalAddress] = useState(address);
  const [isOpen, setIsOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  const handleConnect = (walletType: string) => {
    // Simular conexión de wallet
    const mockAddresses: { [key: string]: string } = {
      metamask: '0x742d35Cc6634C0532925a3b844Bc9e7595f42cA6',
      walletconnect: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      coinbase: '0x3d62d2b78c68d2bF0c9F4C0F8F4b0d8e9a7B4C5d',
    };

    const connected = mockAddresses[walletType] || mockAddresses.metamask;
    setLocalAddress(connected);
    onConnect?.(connected);
    setIsOpen(false);
  };

  const handleManualConnect = () => {
    if (/^0x[a-fA-F0-9]{40}$/.test(manualAddress)) {
      setLocalAddress(manualAddress);
      onConnect?.(manualAddress);
      setManualAddress('');
      setIsOpen(false);
    }
  };

  const handleDisconnect = () => {
    setLocalAddress(null);
    setManualAddress('');
    onDisconnect?.();
  };

  if (localAddress) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-2 hover:bg-red-500/20 rounded-lg transition-all text-red-300 hover:text-red-200 border border-red-500/30 hover:border-red-500/50 flex items-center gap-2 text-sm font-medium"
          title="Disconnect Wallet"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-cyan-500/40 font-semibold whitespace-nowrap">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="border border-slate-700/50 bg-slate-900/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Connect Your Wallet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Popular Wallets */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300">Popular Wallets</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleConnect('metamask')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-700/50 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">🦊</div>
                <span className="text-xs text-slate-400 group-hover:text-orange-300 text-center">MetaMask</span>
              </button>
              <button
                onClick={() => handleConnect('walletconnect')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">📱</div>
                <span className="text-xs text-slate-400 group-hover:text-blue-300 text-center">WalletConnect</span>
              </button>
              <button
                onClick={() => handleConnect('coinbase')}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-700/50 hover:border-blue-600/50 hover:bg-blue-600/10 transition-all group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">💙</div>
                <span className="text-xs text-slate-400 group-hover:text-blue-400 text-center">Coinbase</span>
              </button>
            </div>
          </div>

          {/* Or Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-700/50"></div>
            <span className="text-xs text-slate-500">Or paste address</span>
            <div className="flex-1 h-px bg-slate-700/50"></div>
          </div>

          {/* Manual Address Input */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-slate-300">Enter Address Manually</Label>
            <Input
              id="address"
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f42cA6"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={handleManualConnect}
              disabled={!/^0x[a-fA-F0-9]{40}$/.test(manualAddress)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4 mr-2" />
              Connect Address
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
