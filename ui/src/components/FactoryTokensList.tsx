import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, RefreshCw, Loader2, Zap, Building2 } from 'lucide-react';
import { useState } from 'react';
import { useFactoryTokens } from '@/hooks/useFactoryTokens';
import type { FactoryToken } from '@/hooks/useFactoryTokens';
import { CONTRACTS } from '@/config/contracts';
import { Button } from '@/components/ui/button';

interface FactoryTokenCardProps {
  token: FactoryToken;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}

const FactoryTokenCard = ({ token, copiedId, onCopy }: FactoryTokenCardProps) => {
  const isL1 = token.chainId === CONTRACTS.L1_TOKEN_FACTORY.chainId;
  const explorerUrl = isL1 
    ? `https://sepolia.etherscan.io/address/${token.address}`
    : `https://explorer.celo.org/alfajores/address/${token.address}`;

  return (
    <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all duration-300">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-semibold truncate">{token.name}</span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-semibold whitespace-nowrap">
            {token.symbol}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a 
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors truncate max-w-[120px]"
            title={token.address}
          >
            {token.address.slice(0, 6)}...{token.address.slice(-4)}
          </a>
          <button
            onClick={() => onCopy(token.address, token.address)}
            className="p-1 hover:bg-slate-700/50 rounded transition-all"
            title="Copy address"
          >
            <Copy
              className={`h-3.5 w-3.5 transition-all ${
                copiedId === token.address ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            />
          </button>
        </div>
      </div>
      {/* Token Type Badge - only for L2 tokens */}
      {token.type !== 'l1' && (
        <div className="flex items-center gap-1.5">
          {token.type === 'institutional' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
              <Building2 className="h-3 w-3" />
              Institutional
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs">
              <Zap className="h-3 w-3" />
              High Velocity
            </span>
          )}
          {token.remoteToken && (
            <span className="text-xs text-slate-500" title={`L1: ${token.remoteToken}`}>
              ↔ L1
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const FactoryTokensList = () => {
  const { l1Tokens, l2Tokens, l1TokenCount, l2TokenCount, isLoading, refetch } = useFactoryTokens();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card className="border border-emerald-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="ml-2 text-slate-400">Loading factory tokens...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-emerald-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-emerald-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <span className="text-lg">🏭</span>
            </div>
            <div>
              <CardTitle className="text-white text-xl font-bold">Factory Tokens</CardTitle>
              <p className="text-emerald-300 text-xs mt-1">All tokens created by factories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="ghost"
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-semibold">
              {l1TokenCount + l2TokenCount} total
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* L1 Factory Tokens */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-300 text-sm font-semibold">L1 (Sepolia)</span>
            <span className="text-slate-500 text-xs">• {l1TokenCount} tokens</span>
          </div>
          {l1Tokens.length === 0 ? (
            <p className="text-slate-500 text-sm">No L1 tokens in factory</p>
          ) : (
            <div className="space-y-2">
              {l1Tokens.map((token) => (
                <FactoryTokenCard
                  key={token.address}
                  token={token}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
              ))}
              {l1TokenCount > 3 && (
                <p className="text-slate-500 text-xs text-center">
                  +{l1TokenCount - 3} more tokens
                </p>
              )}
            </div>
          )}
        </div>

        {/* L2 Factory Tokens */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cyan-300 text-sm font-semibold">L2 (Celo Sepolia)</span>
            <span className="text-slate-500 text-xs">• {l2TokenCount} tokens</span>
          </div>
          {l2Tokens.length === 0 ? (
            <p className="text-slate-500 text-sm">No L2 tokens in factory</p>
          ) : (
            <div className="space-y-2">
              {l2Tokens.map((token) => (
                <FactoryTokenCard
                  key={token.address}
                  token={token}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
              ))}
              {l2TokenCount > 3 && (
                <p className="text-slate-500 text-xs text-center">
                  +{l2TokenCount - 3} more tokens
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
