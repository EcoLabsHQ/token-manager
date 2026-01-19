import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useL1TokenFactory } from '@/hooks/useL1TokenFactory';
import { useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const CreateL1TokenDialog = () => {
  const { addToken } = useWallet();
  const { address } = useAccount();
  const { 
    createToken: createTokenOnChain, 
    isLoading: factoryLoading, 
    error: factoryError, 
    tokenAddress, 
    txHash
  } = useL1TokenFactory();
  
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    initialSupply: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async () => {
    setError('');
    setSuccess(false);

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
    if (!formData.initialSupply.trim()) {
      setError('Initial supply is required');
      return;
    }
    
    const initialSupply = parseFloat(formData.initialSupply);
    
    if (isNaN(initialSupply) || initialSupply <= 0) {
      setError('Initial supply must be a positive number');
      return;
    }

    setLoading(true);

    try {
      // Start token creation
      await createTokenOnChain({
        name: formData.name,
        symbol: formData.symbol,
        initialSupply: formData.initialSupply,
      });

      // Wait for the hook to finish processing (max 60 seconds)
      let attempts = 0;
      const maxAttempts = 60;

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
        const newToken = {
          id: txHash || Date.now().toString(),
          address: tokenAddress,
          name: formData.name,
          symbol: formData.symbol,
          decimals: 18, // L1 tokens use 18 decimals
          totalSupply: formData.initialSupply,
          maxSupply: formData.initialSupply, // L1 tokens don't have explicit maxSupply
          owner: address!,
          createdAt: new Date().toISOString(),
        };

        addToken(newToken);
        setSuccess(true);

        // Reset form after 2 seconds
        setTimeout(() => {
          setFormData({
            name: '',
            symbol: '',
            initialSupply: '',
          });
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
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
        <Button className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/50 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Create L1 Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            Create L1 Token (Sepolia)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Factory Address Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">L1 Factory Address:</p>
            <code className="text-xs text-cyan-300 font-mono break-all">
              {CONTRACTS.L1_TOKEN_FACTORY.address}
            </code>
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="initialSupply" className="text-slate-300">Initial Supply</Label>
              <Input
                id="initialSupply"
                name="initialSupply"
                type="number"
                placeholder="e.g., 1000000"
                value={formData.initialSupply}
                onChange={handleInputChange}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={loading}
              />
              <p className="text-xs text-slate-500 mt-1">Decimals: 18 (standard for L1 tokens)</p>
            </div>
          </div>

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
                  {txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 hover:underline"
                    >
                      View on Etherscan <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="flex-1 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading || success}
              className="flex-1 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {loading ? (
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
