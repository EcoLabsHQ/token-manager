import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useInstitutionalTokenDeploy } from '@/hooks/useInstitutionalTokenDeploy';
import { useAccount, useSwitchChain } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const InstitutionalTokenDialog = () => {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const {
    deployInstitutionalToken,
    isLoading: deployLoading,
    error: deployError,
    l1TokenAddress,
    l2TokenAddress,
    currentStep,
  } = useInstitutionalTokenDeploy();

  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState<'form' | 'deploying' | 'complete'>('form');

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    initialSupply: '',
    maxSupply: '',
    decimals: '18',
    bridgeAddress: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Monitor deployment progress
  useEffect(() => {
    if (currentStep === 'idle' || currentStep === 'error') {
      setDeploymentStep('form');
    } else if (currentStep === 'creating_l1' || currentStep === 'creating_l2' || currentStep === 'configuring') {
      setDeploymentStep('deploying');
    } else if (currentStep === 'success' && l1TokenAddress && l2TokenAddress) {
      setSuccess(true);
      setDeploymentStep('complete');

      setTimeout(() => {
        setFormData({
          name: '',
          symbol: '',
          initialSupply: '',
          maxSupply: '',
          decimals: '18',
          bridgeAddress: '',
        });
        setIsOpen(false);
        setSuccess(false);
        setDeploymentStep('form');
      }, 3000);
    }
  }, [currentStep, l1TokenAddress, l2TokenAddress]);

  // Monitor errors
  useEffect(() => {
    if (deployError) {
      setError(deployError);
      setDeploymentStep('form');
    }
  }, [deployError]);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Token name is required');
      return false;
    }
    if (!formData.symbol.trim()) {
      setError('Token symbol is required');
      return false;
    }
    if (!formData.initialSupply.trim()) {
      setError('Initial supply is required');
      return false;
    }
    if (!formData.maxSupply.trim()) {
      setError('Max supply is required');
      return false;
    }

    const decimals = parseInt(formData.decimals);
    const initialSupply = parseFloat(formData.initialSupply);
    const maxSupply = parseFloat(formData.maxSupply);

    // Validate integers (no decimals)
    if (!Number.isInteger(initialSupply)) {
      setError('Initial supply must be a whole number (no decimals)');
      return false;
    }
    if (!Number.isInteger(maxSupply)) {
      setError('Max supply must be a whole number (no decimals)');
      return false;
    }

    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      setError('Decimals must be between 0 and 18');
      return false;
    }

    if (isNaN(initialSupply) || initialSupply <= 0) {
      setError('Initial supply must be a positive number');
      return false;
    }

    if (isNaN(maxSupply) || maxSupply <= 0) {
      setError('Max supply must be a positive number');
      return false;
    }

    if (initialSupply > maxSupply) {
      setError('Initial supply cannot exceed max supply');
      return false;
    }

   

    return true;
  };

  const handleDeploy = async () => {
    setError('');
    setSuccess(false);

    if (!address) {
      setError('Wallet not connected');
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (chainId !== CONTRACTS.L1_TOKEN_FACTORY.chainId) {
      try {
        await switchChain({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError) {
        setError(`Failed to switch to Sepolia. Please manually switch to Sepolia network.`);
        return;
      }
    }

    const result = await deployInstitutionalToken({
      name: formData.name,
      symbol: formData.symbol,
      initialSupply: formData.initialSupply,
      maxSupply: formData.maxSupply,
      decimals: parseInt(formData.decimals),
      bridgeAddress: formData.bridgeAddress || undefined,
    });

    if (!result.success && result.error) {
      setError(result.error);
      setDeploymentStep('form');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-emerald-500/50 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Deploy Institutional Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-emerald-500 to-teal-500 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            Deploy Institutional Token
          </DialogTitle>
        </DialogHeader>

        {deploymentStep === 'form' && (
          <div className="space-y-4 py-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">Institutional Token</p>
              <p className="text-xs text-slate-300">
                This deploys a token on both L1 (Sepolia) and L2 (Celo Sepolia) with bridge configuration.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-slate-300">Token Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Institutional Stablecoin"
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
                  placeholder="e.g., INST"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={deployLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="initialSupply" className="text-slate-300">Initial Supply</Label>
                  <Input
                    id="initialSupply"
                    name="initialSupply"
                    type="number"
                    step="1"
                    placeholder="e.g., 1000000"
                    value={formData.initialSupply}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={deployLoading}
                  />
                  <p className="text-xs text-slate-400 mt-1">Integers only, max: 1 billion</p>
                </div>
                <div>
                  <Label htmlFor="maxSupply" className="text-slate-300">Max Supply</Label>
                  <Input
                    id="maxSupply"
                    name="maxSupply"
                    type="number"
                    step="1"
                    placeholder="e.g., 10000000"
                    value={formData.maxSupply}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={deployLoading}
                  />
                  <p className="text-xs text-slate-400 mt-1">Integers only, max: 1 billion</p>
                </div>
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
            </div>

            {error && (
              <Alert className="bg-red-500/10 border-red-500/30 text-red-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {chainId && chainId !== CONTRACTS.L1_TOKEN_FACTORY.chainId && (
              <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You are on chain {chainId}. Network will switch to Sepolia when you click Deploy.
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
                disabled={deployLoading || isSwitchingChain}
                className="flex-1 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
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
                ) : (
                  <>
                    Deploy Token
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {deploymentStep === 'deploying' && (
          <div className="space-y-4 py-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {(currentStep === 'creating_l1' || currentStep === 'creating_l2' || currentStep === 'configuring') ? (
                    <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Creating L1 Token (Sepolia)</p>
                  <p className="text-xs text-slate-400 mt-1">Deploying token on Sepolia network</p>
                  {l1TokenAddress && (
                    <p className="text-xs text-emerald-300 mt-1 font-mono">✓ {l1TokenAddress.slice(0, 10)}...{l1TokenAddress.slice(-8)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {currentStep === 'creating_l2' || currentStep === 'configuring' ? (
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  ) : currentStep === 'creating_l1' ? (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-600 border-t-slate-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Creating L2 Token (Celo Sepolia)</p>
                  <p className="text-xs text-slate-400 mt-1">Deploying SuperchainToken on Celo Sepolia</p>
                  {l2TokenAddress && (
                    <p className="text-xs text-blue-300 mt-1 font-mono">✓ {l2TokenAddress.slice(0, 10)}...{l2TokenAddress.slice(-8)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {currentStep === 'configuring' ? (
                    <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-600 border-t-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Configure Bridge Connections</p>
                  <p className="text-xs text-slate-400 mt-1">Setting up bridge between L1 and L2 tokens</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {deploymentStep === 'complete' && success && (
          <div className="space-y-4 py-8">
            <Alert className="bg-green-500/10 border-green-500/30 text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Institutional Token Deployed Successfully!</p>
                  <div className="text-xs space-y-1">
                    <p>L1 Token: {l1TokenAddress}</p>
                    <p>L2 Token: {l2TokenAddress}</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setIsOpen(false)}
              className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
