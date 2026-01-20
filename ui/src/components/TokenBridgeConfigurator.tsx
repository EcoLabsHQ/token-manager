import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { L1_TOKEN_ABI, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';

interface TokenBridgeConfiguratorProps {
  l1TokenAddress?: string;
  l2TokenAddress?: string;
  onConfigurationComplete?: () => void;
}

export const TokenBridgeConfigurator = ({
  l1TokenAddress,
  l2TokenAddress,
  onConfigurationComplete,
}: TokenBridgeConfiguratorProps) => {
  const { address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'idle' | 'configuring' | 'complete'>('idle');

  const [formData, setFormData] = useState({
    l1RemoteToken: '',
    l2RemoteToken: '',
    l1Bridge: '',
    l2Bridge: '',
  });

  const { writeContract: writeL1, data: l1Data, isPending: isL1Pending } = useWriteContract();
  const { writeContract: writeL2, data: l2Data, isPending: isL2Pending } = useWriteContract();

  const { isLoading: isL1Receipt } = useWaitForTransactionReceipt({
    hash: l1Data,
    confirmations: 1,
  });

  const { isLoading: isL2Receipt } = useWaitForTransactionReceipt({
    hash: l2Data,
    confirmations: 1,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfigureBridge = async () => {
    setError('');
    setSuccess(false);

    if (!address) {
      setError('Wallet not connected');
      return;
    }

    // Validation
    if (!formData.l2RemoteToken.trim() || !formData.l2Bridge.trim()) {
      setError('L2 remote token and bridge address are required');
      return;
    }

    if (!formData.l1RemoteToken.trim() || !formData.l1Bridge.trim()) {
      setError('L1 remote token and bridge address are required');
      return;
    }

    try {
      setStep('configuring');

      // Configure L2 token with L1 remote token
      if (l2TokenAddress) {
        writeL2({
          address: getAddress(l2TokenAddress),
          abi: L2_SUPERCHAIN_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(formData.l1RemoteToken)],
        });
      }

      // Configure L1 token with L2 remote token
      if (l1TokenAddress) {
        writeL1({
          address: getAddress(l1TokenAddress),
          abi: L1_TOKEN_ABI,
          functionName: 'setRemoteToken',
          args: [getAddress(formData.l2RemoteToken)],
        });
      }

      // Wait for both transactions
      await new Promise((resolve) => {
        setTimeout(() => {
          if (!isL1Receipt && !isL2Receipt) {
            resolve(null);
          }
        }, 1000);
      });

      setStep('complete');
      setSuccess(true);

      if (onConfigurationComplete) {
        onConfigurationComplete();
      }

      // Reset after 2 seconds
      setTimeout(() => {
        setIsOpen(false);
        setFormData({
          l1RemoteToken: '',
          l2RemoteToken: '',
          l1Bridge: '',
          l2Bridge: '',
        });
        setStep('idle');
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Configuration failed';
      setError(errorMsg);
      setStep('idle');
    }
  };

  const isLoading = isL1Pending || isL2Pending || isL1Receipt || isL2Receipt;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          disabled={!l1TokenAddress || !l2TokenAddress}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure Bridge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Bridge Connection
          </DialogTitle>
        </DialogHeader>

        {step === 'idle' && (
          <div className="space-y-4 py-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">Bridge Configuration</p>
              <p className="text-xs text-slate-300">
                Set up the bridge connections between L1 and L2 tokens. This enables cross-chain transfers.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="l1RemoteToken" className="text-slate-300">L1 Token Address</Label>
                <Input
                  id="l1RemoteToken"
                  name="l1RemoteToken"
                  placeholder={l1TokenAddress || '0x...'}
                  value={formData.l1RemoteToken}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="l2RemoteToken" className="text-slate-300">L2 Token Address</Label>
                <Input
                  id="l2RemoteToken"
                  name="l2RemoteToken"
                  placeholder={l2TokenAddress || '0x...'}
                  value={formData.l2RemoteToken}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="l1Bridge" className="text-slate-300">L1 Bridge Address</Label>
                <Input
                  id="l1Bridge"
                  name="l1Bridge"
                  placeholder="0x..."
                  value={formData.l1Bridge}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="l2Bridge" className="text-slate-300">L2 Bridge Address</Label>
                <Input
                  id="l2Bridge"
                  name="l2Bridge"
                  placeholder="0x..."
                  value={formData.l2Bridge}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <Alert className="bg-red-500/10 border-red-500/30 text-red-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                className="flex-1 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfigureBridge}
                disabled={isLoading}
                className="flex-1 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Configuring...
                  </>
                ) : (
                  'Configure Bridge'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'configuring' && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
            <p className="text-center text-slate-300">Configuring bridge connections...</p>
          </div>
        )}

        {step === 'complete' && success && (
          <div className="space-y-4 py-8">
            <Alert className="bg-green-500/10 border-green-500/30 text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Bridge configuration completed successfully!
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setIsOpen(false)}
              className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
