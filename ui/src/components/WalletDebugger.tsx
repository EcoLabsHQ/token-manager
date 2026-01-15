import { useAccount } from 'wagmi';
import { useWallet } from '@/context/WalletContext';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const WalletDebugger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const wagmiAccount = useAccount();
  const contextWallet = useWallet();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 transition-all"
        title="Toggle Wallet Debugger"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-cyan-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-cyan-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-slate-900 border border-slate-700 rounded-lg p-4 w-80 text-xs font-mono space-y-4">
          <div>
            <h3 className="text-cyan-400 font-bold mb-2">📊 Wagmi (useAccount)</h3>
            <div className="bg-slate-800 p-2 rounded space-y-1 text-slate-300">
              <div>
                address:{' '}
                <span className="text-green-400">
                  {wagmiAccount.address ? wagmiAccount.address.slice(0, 10) + '...' : 'undefined'}
                </span>
              </div>
              <div>
                isConnected: <span className="text-blue-400">{String(wagmiAccount.isConnected)}</span>
              </div>
              <div>
                chainId: <span className="text-purple-400">{wagmiAccount.chainId || 'undefined'}</span>
              </div>
              <div>
                isConnecting: <span className="text-yellow-400">{String(wagmiAccount.isConnecting)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-cyan-400 font-bold mb-2">📋 Context (WalletContext)</h3>
            <div className="bg-slate-800 p-2 rounded space-y-1 text-slate-300">
              <div>
                address:{' '}
                <span className="text-green-400">
                  {contextWallet.address ? contextWallet.address.slice(0, 10) + '...' : 'null'}
                </span>
              </div>
              <div>
                isConnected: <span className="text-blue-400">{String(contextWallet.isConnected)}</span>
              </div>
              <div>
                tokens: <span className="text-purple-400">{contextWallet.tokens.length}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-cyan-400 font-bold mb-2">🔗 Env</h3>
            <div className="bg-slate-800 p-2 rounded space-y-1 text-slate-300">
              <div>
                Project ID:{' '}
                <span className="text-orange-400">
                  {import.meta.env.VITE_REOWN_PROJECT_ID?.slice(0, 15) || 'NOT SET'}...
                </span>
              </div>
              <div>
                Env Mode: <span className="text-indigo-400">{import.meta.env.MODE}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              console.clear();
              console.log('=== WALLET DEBUG INFO ===');
              console.log('Wagmi:', wagmiAccount);
              console.log('Context:', contextWallet);
              console.log('=== END DEBUG ===');
            }}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white transition-all"
          >
            Log to Console
          </button>
        </div>
      )}
    </div>
  );
};
