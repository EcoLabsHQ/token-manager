import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Settings, Pause, Play, Lock } from 'lucide-react';

interface AdminPanelProps {
  isPaused: boolean;
  currentMaxSupply: string;
  onTogglePause: (shouldPause: boolean) => Promise<void>;
  onSetMaxSupply: (newMaxSupply: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AdminPanel = ({
  isPaused,
  currentMaxSupply,
  onTogglePause,
  onSetMaxSupply,
  loading,
  error,
}: AdminPanelProps) => {
  const [newMaxSupply, setNewMaxSupply] = useState('');

  const handleTogglePause = async () => {
    try {
      await onTogglePause(!isPaused);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetMaxSupply = async () => {
    try {
      await onSetMaxSupply(newMaxSupply);
      setNewMaxSupply('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card className="border border-orange-700/50 shadow-2xl bg-linear-to-br from-orange-950/80 via-orange-900/80 to-orange-900/80 overflow-hidden backdrop-blur-sm hover:border-orange-700 transition-all duration-300">
      <div className="absolute inset-0 bg-linear-to-r from-orange-500/5 to-yellow-500/5 pointer-events-none" />
      
      <CardHeader className="relative border-b border-orange-800/30 pb-6 bg-linear-to-r from-orange-950/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Lock className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-white text-xl">Admin Panel</CardTitle>
            <p className="text-xs text-orange-300 mt-1">Contract Control</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6 pt-6">
        {error && (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 ml-2">{error}</AlertDescription>
          </Alert>
        )}

        {/* Contract Status Section */}
        <div className="space-y-3 border-b border-orange-800/30 pb-6">
          <div className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-orange-200 uppercase tracking-wider">Contract Status</p>
              <div className={`h-3 w-3 rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
            </div>
            <p className="text-sm text-orange-300 flex items-center gap-2">
              {isPaused ? (
                <>
                  <Pause className="h-5 w-5 text-red-400" />
                  <span>Contract is currently paused</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 text-emerald-400" />
                  <span>Contract is running normally</span>
                </>
              )}
            </p>
          </div>

          <Button
            onClick={handleTogglePause}
            disabled={loading}
            className={`w-full font-semibold transition-all ${
              isPaused
                ? 'bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-emerald-500/30'
                : 'bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-red-500/30'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Processing...
              </>
            ) : isPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume Contract
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause Contract
              </>
            )}
          </Button>
        </div>

        {/* Maximum Supply Section */}
        <div className="space-y-3">
          <div className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4">
            <p className="text-sm font-semibold text-orange-200 uppercase tracking-wider mb-3">Maximum Supply Limit</p>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-orange-300">Current Limit</span>
                <span className="text-sm font-mono font-bold text-orange-100">
                  {parseFloat(currentMaxSupply).toLocaleString()}
                </span>
              </div>
              {currentMaxSupply !== '115792089237316195423570985008687907853269984665640564039457584007913129639935' && (
                <div className="pt-2 border-t border-orange-700/30">
                  <div className="text-xs text-orange-300">
                    Tokens can be minted up to this limit
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-supply" className="text-orange-200 font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              New Maximum Supply
            </Label>
            <Input
              id="max-supply"
              type="number"
              placeholder="10000000"
              value={newMaxSupply}
              onChange={(e) => setNewMaxSupply(e.target.value)}
              disabled={loading}
              className="border-orange-700/30 bg-orange-900/30 text-orange-100 placeholder:text-orange-700 focus:border-orange-500 focus:ring-orange-500/30 transition-all"
            />
          </div>

          <Button
            onClick={handleSetMaxSupply}
            disabled={loading || !newMaxSupply}
            variant="outline"
            className="w-full border-orange-600 bg-orange-600/10 hover:bg-orange-600/20 text-orange-200 hover:text-orange-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-200 border-t-transparent mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Update Maximum Supply
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-orange-800/20 border border-orange-700/30 rounded-lg p-4 mt-6">
          <p className="text-xs font-semibold text-orange-300 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Admin Privileges
          </p>
          <p className="text-xs text-orange-300/70 leading-relaxed">
            These controls are restricted to the contract owner. Use caution when pausing the contract or changing supply limits.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

