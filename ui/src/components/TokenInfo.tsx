import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, TrendingUp, Gauge } from 'lucide-react';
import type { TokenContractState } from '@/hooks/useTokenContract';

interface TokenInfoProps {
  state: TokenContractState | null;
  loading: boolean;
}

export const TokenInfo = ({ state, loading }: TokenInfoProps) => {
  if (loading || !state) {
    return (
      <Card className="border-0 shadow-2xl bg-linear-to-br from-slate-900 to-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-slate-200">Token Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-cyan-400"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const utilizationPercent = state.totalSupply && state.maxSupply 
    ? (parseFloat(state.totalSupply) / parseFloat(state.maxSupply) * 100).toFixed(2)
    : '0';

  return (
    <Card className="border border-slate-700/50 shadow-2xl bg-linear-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 overflow-hidden backdrop-blur-sm hover:border-slate-700 transition-all duration-300">
      <div className="absolute inset-0 bg-linear-to-r from-cyan-500/5 to-blue-500/5 pointer-events-none" />
      
      <CardHeader className="relative border-b border-slate-700/30 pb-6 bg-linear-to-r from-slate-900/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Zap className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-white text-xl">{state.name}</CardTitle>
              <p className="text-xs text-slate-400 mt-1">ERC20 Token Contract</p>
            </div>
          </div>
          <Badge 
            variant={state.paused ? 'destructive' : 'default'}
            className={state.paused 
              ? 'bg-red-500/30 text-red-200 border-red-500/50 text-xs font-semibold' 
              : 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50 text-xs font-semibold'}
          >
            {state.paused ? '⏸ Paused' : '▶ Active'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6 pt-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-linear-to-br from-blue-500/15 to-blue-600/5 border border-blue-500/25 rounded-lg p-4 hover:border-blue-500/40 transition-all">
            <p className="text-xs font-semibold text-blue-300/70 uppercase tracking-wider">Symbol</p>
            <p className="text-2xl font-bold text-blue-200 mt-2">{state.symbol}</p>
          </div>
          <div className="bg-linear-to-br from-purple-500/15 to-purple-600/5 border border-purple-500/25 rounded-lg p-4 hover:border-purple-500/40 transition-all">
            <p className="text-xs font-semibold text-purple-300/70 uppercase tracking-wider">Decimals</p>
            <p className="text-2xl font-bold text-purple-200 mt-2">{state.decimals}</p>
          </div>
          <div className="bg-linear-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-500/25 rounded-lg p-4 hover:border-cyan-500/40 transition-all">
            <p className="text-xs font-semibold text-cyan-300/70 uppercase tracking-wider">Status</p>
            <p className="text-xl font-bold text-cyan-200 mt-2">{state.paused ? 'Paused' : 'Live'}</p>
          </div>
        </div>

        {/* Supply Information */}
        <div className="space-y-3 border-t border-slate-700/30 pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Total Supply</span>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-300">
                {parseFloat(state.totalSupply).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-slate-300">Maximum Supply</span>
              </div>
              <span className="font-mono text-sm font-bold text-purple-300">
                {state.maxSupply === '115792089237316195423570985008687907853269984665640564039457584007913129639935'
                  ? '∞ Unlimited'
                  : parseFloat(state.maxSupply).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Utilization Bar */}
          {state.maxSupply !== '115792089237316195423570985008687907853269984665640564039457584007913129639935' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Utilization</span>
                <span className="text-xs font-bold text-cyan-300">{utilizationPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(parseFloat(utilizationPercent), 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Your Balance */}
        <div className="bg-linear-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 rounded-lg p-4">
          <p className="text-xs font-semibold text-emerald-300/70 uppercase tracking-wider mb-2">Your Balance</p>
          <p className="text-3xl font-bold text-emerald-300">
            {parseFloat(state.userBalance).toLocaleString()}
          </p>
          <p className="text-xs text-emerald-300/50 mt-2">{state.symbol}</p>
        </div>

        {/* Owner Info */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-slate-400">Contract Owner</p>
            <code className="text-sm text-emerald-300 font-mono block mt-1">
              {state.owner.slice(0, 10)}...{state.owner.slice(-8)}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

