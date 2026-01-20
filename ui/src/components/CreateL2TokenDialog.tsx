import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useL2TokenFactory } from '@/hooks/useL2TokenFactory';
import { useAccount, useSwitchChain } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const CreateL2TokenDialog = () => {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { 
    createToken: createTokenOnChain, 
    isLoading: factoryLoading, 
    error: factoryError, 
    tokenAddress, 
    isCorrectChain
  } = useL2TokenFactory();
  
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

  // Effect to handle successful token creation
  useEffect(() => {
    if (tokenAddress && !factoryLoading && !factoryError) {
      console.log('L2 Token created:', tokenAddress);
      setSuccess(true);

      setTimeout(() => {
        setFormData({ name: '', symbol: '', decimals: '18', maxSupply: '' });
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    }
  }, [tokenAddress, factoryLoading, factoryError]);

  // Effect to handle factory errors
  useEffect(() => {
    if (factoryError) {
      setError(factoryError);
    }
  }, [factoryError]);

  const handleCreate = async () => {
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
        setError(`Failed to switch network. Please manually switch to Celo L2 Sepolia.`);
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
    if (isNaN(parseInt(formData.decimals)) || parseInt(formData.decimals) < 0 || parseInt(formData.decimals) > 18) {
      setError('Decimals must be between 0 and 18');
      return;
    }
    if (!formData.maxSupply.trim()) {
      setError('Max supply is required');
      return;
    }
    
    const maxSupply = parseFloat(formData.maxSupply);
    
    if (isNaN(maxSupply) || maxSupply <= 0) {
      setError('Max supply must be a positive number');
      return;
    }

    const result = await createTokenOnChain({
      name: formData.name,
      symbol: formData.symbol,
      decimals: parseInt(formData.decimals),
      maxSupply: formData.maxSupply,
    });

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-cyan-500/50 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Create L2 Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-cyan-500 to-blue-500 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            Create L2 Token (Celo Sepolia)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Factory Address Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">L2 Factory Address:</p>
            <code className="text-xs text-cyan-300 font-mono break-all">
              {CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.address}
            </code>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-slate-300">Token Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., My SuperChain Token"
                value={formData.name}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={factoryLoading}
              />
            </div>

            <div>
              <Label htmlFor="symbol" className="text-slate-300">Token Symbol</Label>
              <Input
                id="symbol"
                name="symbol"
                placeholder="e.g., MSTK"
                value={formData.symbol}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={factoryLoading}
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
                placeholder="18"
                value={formData.decimals}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={factoryLoading}
              />
              <p className="text-xs text-slate-500 mt-1">Must be between 0 and 18</p>
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
                disabled={factoryLoading}
              />
              <p className="text-xs text-slate-500 mt-1">Maximum supply that can be minted</p>
            </div>
          </div>

          {/* Chain info */}
          {!isCorrectChain && chainId && (
            <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are on chain {chainId}. Network will switch automatically to Celo L2 Sepolia when you click Create.
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
                  <p className="font-semibold">Token created successfully!</p>
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
              disabled={factoryLoading || isSwitchingChain}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={factoryLoading || success || isSwitchingChain}
              className="flex-1 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              {isSwitchingChain ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching Network...
                </>
              ) : factoryLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Created!
                </>
              ) : (
                'Create Token'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
