import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Wallet, AlertCircle, Loader2, PenLine, X } from 'lucide-react';

export function LoginPage() {
  const { address, isConnected, isConnecting } = useAccount();
  const { open } = useAppKit();
  const { signIn, isLoading, isSigning, error, isAuthenticated, disconnectWallet } = useAuth();

  // Auto-trigger sign in when wallet connects and not authenticated
  useEffect(() => {
    if (isConnected && !isAuthenticated && !isLoading && !isSigning && !error) {
      // Small delay to ensure wallet is fully ready
      const timer = setTimeout(() => {
        signIn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isAuthenticated, isLoading, isSigning, error, signIn]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Token Manager Admin
          </h1>
          <p className="text-gray-500 text-sm">
            Only factory contract owners can access this dashboard
          </p>
        </div>

        {/* Content based on state */}
        <div className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          {/* Not connected */}
          {!isConnected && !isConnecting && (
            <button
              onClick={() => open()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>
          )}

          {/* Connecting */}
          {isConnecting && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-600 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting wallet...
            </div>
          )}

          {/* Connected and waiting for signature (Safe multisig) */}
          {isConnected && isSigning && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Disconnect wallet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-3 px-4 py-6 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg">
                <PenLine className="w-8 h-8 animate-pulse" />
                <div className="text-center">
                  <p className="font-medium">Waiting for signature...</p>
                  <p className="text-sm text-amber-600 mt-1">
                    Please sign the message in your wallet.
                    <br />
                    <span className="text-xs">For Safe, this may require multiple signers.</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Connected but loading (checking ownership) */}
          {isConnected && isLoading && !isSigning && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Disconnect wallet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-600 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying ownership...
              </div>
            </div>
          )}

          {/* Connected with error - show retry */}
          {isConnected && !isLoading && !isSigning && error && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Disconnect wallet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={signIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400">
            You will be asked to sign a message to verify ownership.
            <br />
            This doesn't cost any gas.
          </p>
        </div>
      </div>
    </div>
  );
}
