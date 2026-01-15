import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Copy } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useState } from 'react';

interface TokenListProps {
  onSelectToken?: (tokenId: string, tokenAddress: string) => void;
}

export const TokenList = ({ onSelectToken }: TokenListProps) => {
  const { tokens, removeToken } = useWallet();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (tokens.length === 0) {
    return (
      <Card className="border border-slate-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
        <CardHeader className="pb-6 border-b border-slate-700/30">
          <CardTitle className="text-white text-xl">Your Tokens</CardTitle>
        </CardHeader>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <div className="text-5xl">🎁</div>
          <div>
            <p className="text-slate-300 font-semibold">No tokens yet</p>
            <p className="text-slate-500 text-sm mt-1">Create your first High Velocity Token</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm">
      <CardHeader className="pb-6 border-b border-slate-700/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-2xl font-bold">Your Tokens</CardTitle>
          <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-semibold">
            {tokens.length} token{tokens.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="group bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white font-bold text-lg">{token.name}</h4>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold whitespace-nowrap">
                      {token.symbol}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Supply: <span className="text-cyan-300 font-mono font-semibold">{parseFloat(token.totalSupply).toLocaleString()}</span>
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Max Supply: <span className="text-purple-300 font-mono font-semibold">{parseFloat(token.maxSupply).toLocaleString()}</span>
                  </p>
                  <div className="mt-3 bg-slate-900/50 rounded p-2 border border-slate-700/20">
                    <p className="text-xs text-slate-500 mb-1">Contract Address</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono text-slate-300 truncate">
                        {token.address}
                      </code>
                      <button
                        onClick={() => copyToClipboard(token.address, token.id)}
                        className="p-1 hover:bg-slate-700/50 rounded transition-all shrink-0"
                        title="Copy address"
                      >
                        <Copy
                          className={`h-4 w-4 transition-all ${
                            copiedId === token.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-sm text-slate-300 font-mono">
                    {new Date(token.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button
                  onClick={() => onSelectToken?.(token.id, token.address)}
                  className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold w-full transition-all"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Manage
                </Button>
                <Button
                  onClick={() => removeToken(token.id)}
                  variant="destructive"
                  className="h-9 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-600/50 text-sm font-semibold w-full transition-all"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
