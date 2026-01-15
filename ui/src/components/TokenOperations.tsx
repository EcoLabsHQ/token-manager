import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Send, Flame, Plus, ArrowRight } from 'lucide-react';

interface TokenOperationsProps {
  onMint: (to: string, amount: string) => Promise<void>;
  onBurn: (amount: string) => Promise<void>;
  onTransfer: (to: string, amount: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const TokenOperations = ({
  onMint,
  onBurn,
  onTransfer,
  loading,
  error,
}: TokenOperationsProps) => {
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('transfer');

  const handleMint = async () => {
    try {
      await onMint(mintTo, mintAmount);
      setSuccessMessage('✨ Tokens minted successfully!');
      setMintTo('');
      setMintAmount('');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBurn = async () => {
    try {
      await onBurn(burnAmount);
      setSuccessMessage('🔥 Tokens burned successfully!');
      setBurnAmount('');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransfer = async () => {
    try {
      await onTransfer(transferTo, transferAmount);
      setSuccessMessage('✓ Transfer completed successfully!');
      setTransferTo('');
      setTransferAmount('');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card className="border border-slate-700/50 shadow-2xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm hover:border-slate-700 transition-all duration-300">
      <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-cyan-500/5 pointer-events-none" />
      
      <CardHeader className="relative border-b border-slate-700/30 pb-6 bg-linear-to-r from-slate-900/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <ArrowRight className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-white text-xl">Token Operations</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Transfer, Mint & Burn</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4 pt-6">
        {error && (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 animate-fadeIn">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 ml-2">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-emerald-500/50 bg-emerald-500/10 animate-fadeIn">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-emerald-300 ml-2">{successMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700/50 p-1 gap-1">
            <TabsTrigger 
              value="transfer"
              className="data-[state=active]:bg-blue-500/30 data-[state=active]:text-blue-300 data-[state=active]:border-blue-500/50 border border-transparent rounded-md transition-all duration-200"
            >
              <Send className="h-4 w-4 mr-2" />
              Transfer
            </TabsTrigger>
            <TabsTrigger 
              value="mint"
              className="data-[state=active]:bg-emerald-500/30 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/50 border border-transparent rounded-md transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Mint
            </TabsTrigger>
            <TabsTrigger 
              value="burn"
              className="data-[state=active]:bg-red-500/30 data-[state=active]:text-red-300 data-[state=active]:border-red-500/50 border border-transparent rounded-md transition-all duration-200"
            >
              <Flame className="h-4 w-4 mr-2" />
              Burn
            </TabsTrigger>
          </TabsList>

          {/* Transfer Tab */}
          <TabsContent value="transfer" className="space-y-4 mt-6 animate-fadeIn">
            <div className="space-y-2">
              <Label htmlFor="transfer-to" className="text-slate-300 font-semibold">Recipient Address</Label>
              <Input
                id="transfer-to"
                placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f42cA6"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                disabled={loading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-amount" className="text-slate-300 font-semibold">Amount</Label>
              <Input
                id="transfer-amount"
                type="number"
                placeholder="1000"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                disabled={loading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <Button
              onClick={handleTransfer}
              disabled={loading || !transferTo || !transferAmount}
              className="w-full bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Transfer Tokens
                </>
              )}
            </Button>
          </TabsContent>

          {/* Mint Tab */}
          <TabsContent value="mint" className="space-y-4 mt-6 animate-fadeIn">
            <div className="space-y-2">
              <Label htmlFor="mint-to" className="text-slate-300 font-semibold">Recipient Address</Label>
              <Input
                id="mint-to"
                placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f42cA6"
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
                disabled={loading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/30 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mint-amount" className="text-slate-300 font-semibold">Amount to Mint</Label>
              <Input
                id="mint-amount"
                type="number"
                placeholder="1000"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                disabled={loading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/30 transition-all"
              />
            </div>
            <Button
              onClick={handleMint}
              disabled={loading || !mintTo || !mintAmount}
              className="w-full bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Mint Tokens
                </>
              )}
            </Button>
          </TabsContent>

          {/* Burn Tab */}
          <TabsContent value="burn" className="space-y-4 mt-6 animate-fadeIn">
            <div className="space-y-2">
              <Label htmlFor="burn-amount" className="text-slate-300 font-semibold">Amount to Burn</Label>
              <Input
                id="burn-amount"
                type="number"
                placeholder="1000"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                disabled={loading}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-red-500 focus:ring-red-500/30 transition-all"
              />
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              ⚠️ This action is permanent and cannot be undone.
            </div>
            <Button
              onClick={handleBurn}
              disabled={loading || !burnAmount}
              className="w-full bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 mr-2" />
                  Burn Tokens
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

