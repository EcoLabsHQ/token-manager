import { useState } from 'react';
import './App.css';
import { useTokenContract } from '@/hooks/useTokenContract';
import { TokenInfo } from '@/components/TokenInfo';
import { TokenOperations } from '@/components/TokenOperations';
import { AdminPanel } from '@/components/AdminPanel';
import { ReownConnectButton } from '@/components/ReownConnectButton';
import { DeploymentPanel } from '@/components/DeploymentPanel';
import { FactoryTokensList } from '@/components/FactoryTokensList';
import { useWallet } from '@/context/WalletContext';
import { Button } from '@/components/ui/button';
import { Zap, Github, ExternalLink, Home } from 'lucide-react';
import { useAccount } from 'wagmi';

function App() {
  const [selectedToken, setSelectedToken] = useState<{ id: string; address: string } | null>(null);
  const { address } = useWallet();
  const { chainId } = useAccount();

  const {
    state,
    loading,
    error,
    mint,
    burn,
    transfer,
    togglePause,
    setMaxSupply,
  } = useTokenContract(selectedToken?.address || '');

  const handleBackToList = () => {
    setSelectedToken(null);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-6000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto space-y-8">
        {/* Navigation Header - Sticky */}
        <div className="flex items-center justify-between py-4 px-4 md:px-6 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg sticky top-4 z-50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-linear-to-br from-cyan-500 to-blue-500 rounded-lg shrink-0">
              <Zap className="h-5 md:h-6 w-5 md:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold text-white truncate">Token Manager</h2>
              <p className="text-xs text-slate-400">Kolektivo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {chainId && (
              <div className={`text-xs px-3 py-2 rounded-lg border font-semibold hidden sm:block ${
                chainId === 11155111 || chainId === 44787
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
              }`}>
                {chainId === 11155111 ? '✓ Sepolia' : chainId === 44787 ? '✓ Celo Sepolia' : `Chain: ${chainId}`}
              </div>
            )}
            {address && (
              <div className="text-xs bg-cyan-500/20 text-cyan-300 px-2 md:px-4 py-2 rounded-lg border border-cyan-500/30 font-mono hidden sm:block truncate max-w-xs">
                {address.slice(0, 10)}...{address.slice(-8)}
              </div>
            )}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-800/50 rounded-lg transition-all hidden sm:block shrink-0">
              <Github className="h-5 w-5 text-slate-400 hover:text-white" />
            </a>
            {address && <div className="w-px h-6 bg-slate-700/50 hidden sm:block"></div>}
            <ReownConnectButton />
          </div>
        </div>

        {/* Main Content */}
        {selectedToken ? (
          // Token Manager View
          <>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Manage Token</h1>
                <p className="text-slate-400 text-sm md:text-base">
                  Token Address: <code className="text-cyan-300 font-mono">{selectedToken.address}</code>
                </p>
              </div>
              <Button
                onClick={handleBackToList}
                className="bg-slate-700 hover:bg-slate-600 text-white w-full md:w-auto"
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
              <div className="lg:col-span-2 space-y-6">
                <TokenInfo state={state} loading={loading} />
                <TokenOperations
                  onMint={mint}
                  onBurn={burn}
                  onTransfer={transfer}
                  loading={loading}
                  error={error}
                />
              </div>

              <div className="space-y-6">
                {state && (
                  <AdminPanel
                    isPaused={state.paused}
                    currentMaxSupply={state.maxSupply}
                    onTogglePause={togglePause}
                    onSetMaxSupply={setMaxSupply}
                    loading={loading}
                    error={error}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          // Dashboard View - Clean Layout
          <>
            {/* Hero Section */}
            <div className="text-center space-y-3 mb-12 md:mb-16">
              <div className="inline-block">
                <div className="text-6xl md:text-8xl mb-4 animate-bounce">⚡</div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                High Velocity Tokens
              </h1>
              <p className="text-base md:text-lg text-slate-300 font-light">
                Create and manage your tokens with ease
              </p>
            </div>

            {/* Content Area */}
            {address ? (
              // Connected State - Factory Tokens
              <div className="w-full space-y-8">
                {/* Deployment Panel */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Deploy Tokens</h2>
                  <DeploymentPanel />
                </div>

                {/* Factory Tokens - Show all tokens from factories */}
                <div className="pt-8 border-t border-slate-700/30">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Factory Tokens</h2>
                  <FactoryTokensList />
                </div>
                
                {/* Bridge flow commented out - TODO: implement when bridge contracts are ready
                <div className="mt-8 pt-8 border-t border-slate-700/30">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Bridge Tokens</h2>
                  <BridgeDialog />
                </div>
                */}
              </div>
            ) : (
              // Disconnected State - Call to Action
              <div className="py-20 md:py-32 px-6 md:px-8 text-center bg-linear-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-xl">
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="text-5xl md:text-6xl">🔐</div>
                  <h2 className="text-2xl md:text-4xl font-bold text-slate-200">
                    Welcome to Token Manager
                  </h2>
                  <p className="text-slate-400 text-base md:text-lg">
                    Connect your wallet to create and manage your High Velocity Tokens
                  </p>
                  <p className="text-slate-500 text-sm md:text-base">
                    Click <span className="text-cyan-300 font-semibold">Connect Wallet</span> in the top right corner to get started
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-slate-800/50 text-center space-y-2 md:space-y-3">
          <p className="text-xs md:text-sm text-slate-400 flex items-center justify-center gap-1 md:gap-2 flex-wrap">
            <span>High Velocity Token Manager</span>
            <span className="text-slate-600">•</span>
            <span>Built for Web3</span>
            <span className="text-slate-600">•</span>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-all inline-flex items-center gap-1">
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p className="text-xs text-slate-600">
            © 2024 Kolektivo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
