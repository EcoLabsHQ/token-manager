import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useHighVelocityTokenDeploy } from '@/hooks/useHighVelocityTokenDeploy';
import { useAccount, useSwitchChain } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const HighVelocityTokenDialog = () => {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const {
    deployToken,
    isLoading: deployLoading,
    error: deployError,
    tokenAddress,
    isCorrectChain,
  } = useHighVelocityTokenDeploy();

  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: '18',
    maxSupply: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Effect to handle successful token deployment
  useEffect(() => {
    if (tokenAddress && !deployLoading && !deployError) {
      console.log('HighVelocity Token created:', tokenAddress);
      setSuccess(true);

      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({ name: '', symbol: '', decimals: '18', maxSupply: '' });
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    }
  }, [tokenAddress, deployLoading, deployError]);

  // Effect to handle deployment errors
  useEffect(() => {
    if (deployError) {
      setError(deployError);
    }
  }, [deployError]);

  const handleDeploy = async () => {
    setError('');
    setSuccess(false);

    if (!address) {
      setError('Wallet not connected');
      return;
    }

    // Auto-switch to correct chain if not on it
    if (!isCorrectChain) {
      try {
        await switchChain({ chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId });
        // Wait a bit for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError) {
        setError(`Failed to switch network. Please manually switch to Celo Sepolia.`);
        return;
      }
    }

    // Validation
    if (!formData.name.trim()) {
      setError('Token name is required');
      return;
    }
    if (!formData.symbol.trim()) {
      setError('Token symbol is required');
      return;
    }
    if (!formData.maxSupply.trim()) {
      setError('Max supply is required');
      return;
    }

    const decimals = parseInt(formData.decimals);
    const maxSupply = parseFloat(formData.maxSupply);

    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      setError('Decimals must be between 0 and 18');
      return;
    }

    if (isNaN(maxSupply) || maxSupply <= 0) {
      setError('Max supply must be a positive number');
      return;
    }

    // Deploy token
    const result = await deployToken({
      name: formData.name,
      symbol: formData.symbol,
      decimals,
      maxSupply: formData.maxSupply,
    });

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-blue-500/50 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Deploy High Velocity Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-blue-500 to-cyan-500 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            Deploy High Velocity Token (Celo Sepolia)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Box */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2">High Velocity Token</p>
            <p className="text-xs text-slate-300">
              This deploys a SuperchainToken on Celo Sepolia L2 without bridge configuration. 
              Use this for tokens that don't require L1 bridging.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-slate-300">Token Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., My Token"
                value={formData.name}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={deployLoading}
              />
            </div>

            <div>
              <Label htmlFor="symbol" className="text-slate-300">Token Symbol</Label>
              <Input
                id="symbol"
                name="symbol"
                placeholder="e.g., MTK"
                value={formData.symbol}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={deployLoading}
              />
            </div>

            <div>
              <Label htmlFor="decimals" className="text-slate-300">Decimals</Label>
              <Input
                id="decimals"
                name="decimals"
                type="number"
                min="0"
                max="18"
                value={formData.decimals}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={deployLoading}
              />
            </div>

            <div>
              <Label htmlFor="maxSupply" className="text-slate-300">Max Supply</Label>
              <Input
                id="maxSupply"
                name="maxSupply"
                type="number"
                placeholder="e.g., 1000000"
                value={formData.maxSupply}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={deployLoading}
              />
            </div>
          </div>

          {/* Chain info */}
          {!isCorrectChain && chainId && (
            <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are on chain {chainId}. Network will switch automatically to Celo Sepolia when you click Deploy.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="bg-red-500/10 border-red-500/30 text-red-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && tokenAddress && (
            <Alert className="bg-green-500/10 border-green-500/30 text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Token deployed successfully!</p>
                  <p className="text-xs">Address: {tokenAddress}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="flex-1 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              disabled={deployLoading || isSwitchingChain}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={deployLoading || success || isSwitchingChain}
              className="flex-1 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              {isSwitchingChain ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching Network...
                </>
              ) : deployLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Deployed!
                </>
              ) : (
                'Deploy Token'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
