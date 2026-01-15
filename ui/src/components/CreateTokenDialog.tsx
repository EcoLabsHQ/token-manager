import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Zap, AlertCircle } from 'lucide-react';
import { useWallet, type Token } from '@/context/WalletContext';
import { useTokenFactory } from '@/hooks/useTokenFactory';
import { useAccount } from 'wagmi';
import { celo } from 'viem/chains';

export const CreateTokenDialog = () => {
  const { addToken } = useWallet();
  const { address, chainId } = useAccount();
  const { createToken: createTokenOnChain, isLoading: factoryLoading, error: factoryError, tokenAddress, txHash } = useTokenFactory();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: '18',
    initialSupply: '',
    maxSupply: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async () => {
    setError('');

    // Check if on CELO network
    if (chainId !== celo.id) {
      setError(`Please switch to CELO network (Chain ID: ${celo.id})`);
      return;
    }

    if (!address) {
      setError('Wallet not connected');
      return;
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
    if (!formData.initialSupply.trim()) {
      setError('Initial supply is required');
      return;
    }
    if (!formData.maxSupply.trim()) {
      setError('Max supply is required');
      return;
    }
    
    const initialSupply = parseFloat(formData.initialSupply);
    const maxSupply = parseFloat(formData.maxSupply);
    
    if (isNaN(initialSupply) || initialSupply <= 0) {
      setError('Initial supply must be a positive number');
      return;
    }
    if (isNaN(maxSupply) || maxSupply <= 0) {
      setError('Max supply must be a positive number');
      return;
    }
    if (initialSupply > maxSupply) {
      setError('Initial supply cannot exceed max supply');
      return;
    }

    setLoading(true);

    try {
      // Start token creation
      await createTokenOnChain({
        name: formData.name,
        symbol: formData.symbol,
        decimals: parseInt(formData.decimals),
        initialSupply: formData.initialSupply,
        maxSupply: formData.maxSupply,
      });

      // Wait for the hook to finish processing (max 30 seconds)
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        if (factoryLoading === false) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      // Check if token was successfully created
      if (!factoryError && tokenAddress) {
        // Create token object with REAL address from blockchain
        const newToken: Token = {
          id: txHash || Date.now().toString(),
          address: tokenAddress,
          name: formData.name,
          symbol: formData.symbol,
          decimals: parseInt(formData.decimals),
          totalSupply: formData.initialSupply,
          maxSupply: formData.maxSupply,
          owner: address!,
          createdAt: new Date().toISOString(),
        };

        addToken(newToken);

        // Reset form
        setFormData({
          name: '',
          symbol: '',
          decimals: '18',
          initialSupply: '',
          maxSupply: '',
        });

        setIsOpen(false);
      } else if (factoryError) {
        setError(factoryError);
      } else {
        setError('Token creation timed out. Please check the transaction status.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-emerald-500/40 font-semibold py-5 md:py-6 text-sm md:text-base whitespace-nowrap">
          <Plus className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
          <span className="hidden sm:inline">Create New Token</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="border border-slate-700/50 bg-slate-900/95 backdrop-blur-md max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400" />
            Create High Velocity Token
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {(error || factoryError) && (
            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300 ml-2">{error || factoryError}</AlertDescription>
            </Alert>
          )}

          {chainId && chainId !== celo.id && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300 ml-2">
                Please switch to CELO network to create tokens
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300 font-semibold">Token Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., High Velocity Token"
              value={formData.name}
              onChange={handleInputChange}
              disabled={loading || factoryLoading}
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-slate-300 font-semibold">Token Symbol</Label>
            <Input
              id="symbol"
              name="symbol"
              placeholder="e.g., HVT"
              maxLength={10}
              value={formData.symbol}
              onChange={handleInputChange}
              disabled={loading || factoryLoading}
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="decimals" className="text-slate-300 font-semibold">Decimals</Label>
              <Input
                id="decimals"
                name="decimals"
                type="number"
                min="0"
                max="18"
                value={formData.decimals}
                onChange={handleInputChange}
                disabled={loading || factoryLoading}
                className="border-slate-700 bg-slate-800/50 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialSupply" className="text-slate-300 font-semibold">Initial Supply</Label>
              <Input
                id="initialSupply"
                name="initialSupply"
                type="number"
                placeholder="1000000"
                value={formData.initialSupply}
                onChange={handleInputChange}
                disabled={loading || factoryLoading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSupply" className="text-slate-300 font-semibold">Maximum Supply</Label>
            <Input
              id="maxSupply"
              name="maxSupply"
              type="number"
              placeholder="10000000"
              value={formData.maxSupply}
              onChange={handleInputChange}
              disabled={loading || factoryLoading}
              className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">Must be equal or greater than initial supply</p>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">Token Details Preview:</p>
            <div className="space-y-1 font-mono text-slate-500">
              <p>Name: {formData.name || '(empty)'}</p>
              <p>Symbol: {formData.symbol || '(empty)'}</p>
              <p>Decimals: {formData.decimals}</p>
              <p>Initial Supply: {formData.initialSupply || '(empty)'}</p>
              <p>Max Supply: {formData.maxSupply || '(empty)'}</p>
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading || factoryLoading || !formData.name || !formData.symbol || !formData.initialSupply || !formData.maxSupply || (chainId && chainId !== celo.id) || !address}
            className="w-full bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || factoryLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Creating Token...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Create Token
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
