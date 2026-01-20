import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Copy, Loader2 } from 'lucide-react';

interface DeploymentResult {
  l1TokenAddress: string;
  l2TokenAddress: string;
  l1TxHash?: string;
  l2TxHash?: string;
}

interface InstitutionalTokenSummaryProps {
  deployment: DeploymentResult;
  onConfigure?: () => void;
}

export const InstitutionalTokenSummary = ({
  deployment,
  onConfigure,
}: InstitutionalTokenSummaryProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border border-emerald-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-emerald-700/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            Deployment Complete
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Deployment Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* L1 Token */}
          <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-purple-500/20 rounded">
                <span className="text-sm font-semibold text-purple-300">L1</span>
              </div>
              <p className="text-sm font-semibold text-white">Sepolia Token</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-400">Contract Address</p>
                <button
                  onClick={() => copyToClipboard(deployment.l1TokenAddress, 'l1')}
                  className="text-xs font-mono text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
                >
                  {deployment.l1TokenAddress.slice(0, 10)}...{deployment.l1TokenAddress.slice(-8)}
                  <Copy
                    className={`h-3 w-3 transition-all ${
                      copiedId === 'l1' ? 'text-emerald-400' : ''
                    }`}
                  />
                </button>
              </div>

              {deployment.l1TxHash && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-400">Transaction</p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${deployment.l1TxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-cyan-300 hover:text-cyan-100 transition-colors"
                  >
                    View on Explorer →
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-slate-300">Deployed</span>
              </div>
            </div>
          </div>

          {/* L2 Token */}
          <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-cyan-500/20 rounded">
                <span className="text-sm font-semibold text-cyan-300">L2</span>
              </div>
              <p className="text-sm font-semibold text-white">Celo Sepolia Token</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-400">Contract Address</p>
                <button
                  onClick={() => copyToClipboard(deployment.l2TokenAddress, 'l2')}
                  className="text-xs font-mono text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
                >
                  {deployment.l2TokenAddress.slice(0, 10)}...{deployment.l2TokenAddress.slice(-8)}
                  <Copy
                    className={`h-3 w-3 transition-all ${
                      copiedId === 'l2' ? 'text-emerald-400' : ''
                    }`}
                  />
                </button>
              </div>

              {deployment.l2TxHash && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-400">Transaction</p>
                  <a
                    href={`https://explorer.celo.org/alfajores/tx/${deployment.l2TxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-cyan-300 hover:text-cyan-100 transition-colors"
                  >
                    View on Explorer →
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-slate-300">Deployed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-4">
          <p className="text-sm font-semibold text-white mb-3">Next Steps</p>
          <ol className="text-xs text-slate-300 space-y-2">
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">1.</span>
              <span>Bridge configuration has been automatically set up</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">2.</span>
              <span>Your tokens are now ready for cross-chain transfers</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>Use the Bridge feature to transfer tokens between chains</span>
            </li>
          </ol>
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="text-xs">
              Save these contract addresses. You'll need them for bridge operations and further token management.
            </p>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {onConfigure && (
            <Button
              onClick={onConfigure}
              className="flex-1 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              Configure Additional Settings
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Component para mostrar estado de despliegue en progreso
export const DeploymentProgress = () => {
  return (
    <Card className="border border-cyan-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin">
            <Loader2 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Deploying tokens...</p>
            <p className="text-xs text-slate-400">This may take 5-8 minutes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
