import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBridge, L1_TOKEN, L2_TOKEN, BRIDGE_AMOUNT } from '@/hooks/useBridge';
import { useAccount } from 'wagmi';
import { sepolia } from 'viem/chains';
import { AlertCircle, Zap, CheckCircle2, Clock } from 'lucide-react';

export const BridgeDialog = () => {
  const { address, chainId } = useAccount();
  const { getBalance, bridge, isLoading, error } = useBridge();

  const [l1Balance, setL1Balance] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'bridging' | 'success'>('info');
  const [txData, setTxData] = useState<{ bridge?: string; blockNumber?: string } | null>(null);

  // Fetch L1 balance
  useEffect(() => {
    if (address && chainId === sepolia.id) {
      getBalance().then(setL1Balance);
    }
  }, [address, chainId, getBalance]);

  const handleStartBridge = async () => {
    if (!address || chainId !== sepolia.id) return;

    setStep('bridging');
    
    const result = await bridge();
    if (result.success) {
      setTxData({
        bridge: result.txHash,
        blockNumber: result.blockNumber ? String(result.blockNumber) : undefined,
      });
      setStep('success');
    } else {
      setStep('info');
    }
  };

  const isOnL1 = chainId === sepolia.id;

  return (
    <Card className="border border-slate-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
      <CardHeader className="pb-6 border-b border-slate-700/30">
        <CardTitle className="text-white text-xl flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-400" />
          Bridge Tokens
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {!isOnL1 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300 ml-2">
              Switch to Sepolia network to bridge tokens
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 ml-2">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {step === 'info' && (
          <div className="space-y-4">
            {/* Token Details */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase">Amount to Bridge</p>
                <p className="text-lg font-semibold text-emerald-400">{BRIDGE_AMOUNT}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Your L1 Balance</p>
                <p className="text-sm font-mono text-slate-300">
                  {l1Balance ? `${l1Balance}` : 'Loading...'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-700/30">
                <p className="text-xs text-slate-400 uppercase mb-2">Token Addresses</p>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <p className="text-slate-500">L1 (Sepolia)</p>
                    <p className="text-slate-300 break-all">{L1_TOKEN}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">L2 (Celo Sepolia)</p>
                    <p className="text-slate-300 break-all">{L2_TOKEN}</p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartBridge}
              disabled={!isOnL1 || isLoading}
              className="w-full bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Bridge
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'bridging' && (
          <div className="space-y-3">
            <div className="bg-slate-800/30 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-400 animate-spin" />
                <p className="font-semibold text-blue-300">Bridging Tokens...</p>
              </div>
              <p className="text-xs text-slate-400">Transferring {BRIDGE_AMOUNT} tokens to L2</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-3">
            <div className="bg-slate-800/30 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="font-semibold text-emerald-300">Bridge Completed!</p>
              </div>
              {txData && (
                <div className="space-y-2 text-xs">
                  {txData.bridge && (
                    <div>
                      <p className="text-slate-400">Bridge TX:</p>
                      <p className="text-slate-300 font-mono break-all">{txData.bridge}</p>
                    </div>
                  )}
                  {txData.blockNumber && (
                    <div>
                      <p className="text-slate-400">Block Number:</p>
                      <p className="text-slate-300">{txData.blockNumber}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={() => {
                setStep('info');
                setTxData(null);
              }}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white"
            >
              Bridge More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
