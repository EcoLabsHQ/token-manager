import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useSwitchChain,
} from 'wagmi';
import { celo } from 'viem/chains';

// ABIs for L2SuperChainToken
const SET_BRIDGE_ABI = [
  {
    name: 'setBridge',
    type: 'function',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const GET_BRIDGE_ABI = [
  {
    name: 'bridge',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

// L2 Standard Bridge address on Celo Mainnet
const L2_BRIDGE = '0x4200000000000000000000000000000000000010';

// Explorer URLs
const EXPLORER_URLS = {
  ethereum: 'https://etherscan.io/tx/',
  celo: 'https://celoscan.io/tx/',
};

type SetupStep = 'checking' | 'switch-chain' | 'set-bridge' | 'complete' | 'error';

export default function SetupBridge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const l1Token = searchParams.get('l1Token');
  const l2Token = searchParams.get('l2Token');

  const [step, setStep] = useState<SetupStep>('checking');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const celoClient = usePublicClient({ chainId: celo.id });
  const { switchChainAsync } = useSwitchChain();

  // Check current bridge status on load
  useEffect(() => {
    const checkBridgeStatus = async () => {
      if (!l2Token || !celoClient) return;

      try {
        const bridge = await celoClient.readContract({
          address: l2Token as `0x${string}`,
          abi: GET_BRIDGE_ABI,
          functionName: 'bridge',
        });

        if (bridge && bridge !== '0x0000000000000000000000000000000000000000') {
          setStep('complete');
        } else {
          // Check if on correct chain
          if (chainId !== celo.id) {
            setStep('switch-chain');
          } else {
            setStep('set-bridge');
          }
        }
      } catch (err) {
        console.error('Error checking bridge status:', err);
        setError('Error checking current bridge status');
        setStep('error');
      }
    };

    checkBridgeStatus();
  }, [l2Token, celoClient, chainId]);

  const handleSwitchChain = async () => {
    setIsProcessing(true);
    try {
      await switchChainAsync({ chainId: celo.id });
      setStep('set-bridge');
    } catch (err) {
      console.error('Error switching chain:', err);
      setError('Failed to switch to Celo network');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetBridge = async () => {
    if (!l2Token || !walletClient || !celoClient) {
      setError('Missing required data');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Send setBridge transaction
      const hash = await walletClient.writeContract({
        address: l2Token as `0x${string}`,
        abi: SET_BRIDGE_ABI,
        functionName: 'setBridge',
        args: [L2_BRIDGE],
      });

      setTxHash(hash);

      // Wait for confirmation
      await celoClient.waitForTransactionReceipt({ hash });

      setStep('complete');
    } catch (err: any) {
      console.error('Error setting bridge:', err);
      if (err.message?.includes('User rejected')) {
        setError('Transaction rejected by user');
      } else {
        setError(err.message || 'Failed to set bridge');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoBack = () => {
    navigate('/', { state: { fromTokenCreation: true } });
  };

  if (!l1Token || !l2Token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-lg text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Missing Token Information
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mb-4 sm:mb-6">
            The required token addresses are missing. Please go back and try again.
          </p>
          <button
            onClick={handleGoBack}
            className="bg-black text-white px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base hover:bg-gray-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-lg w-full shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={handleGoBack}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Complete Bridge Setup
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Configure the L2 token to use the standard bridge
            </p>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="space-y-2 sm:space-y-3">
            <div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
                L1 Token (Ethereum)
              </span>
              <p className="font-mono text-xs sm:text-sm text-gray-900 mt-0.5 sm:mt-1 break-all">
                {l1Token}
              </p>
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
                L2 Token (Celo)
              </span>
              <p className="font-mono text-xs sm:text-sm text-gray-900 mt-0.5 sm:mt-1 break-all">
                {l2Token}
              </p>
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
                Bridge Address
              </span>
              <p className="font-mono text-xs sm:text-sm text-gray-900 mt-0.5 sm:mt-1 break-all">
                {L2_BRIDGE}
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 sm:space-y-4">
          {step === 'checking' && (
            <div className="flex items-center justify-center py-6 sm:py-8">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-gray-400" />
              <span className="ml-2 sm:ml-3 text-gray-600 text-sm sm:text-base">Checking bridge status...</span>
            </div>
          )}

          {step === 'switch-chain' && (
            <div className="text-center py-3 sm:py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 mx-auto mb-1.5 sm:mb-2" />
                <p className="text-yellow-800 font-medium text-sm sm:text-base">
                  Switch to Celo Sepolia
                </p>
                <p className="text-yellow-600 text-xs sm:text-sm mt-1">
                  You need to be on Celo Sepolia network to set the bridge.
                </p>
              </div>
              <button
                onClick={handleSwitchChain}
                disabled={isProcessing}
                className="w-full bg-black text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base
                           hover:bg-gray-800 transition-colors disabled:opacity-50 
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Switching...
                  </>
                ) : (
                  'Switch Network'
                )}
              </button>
            </div>
          )}

          {step === 'set-bridge' && (
            <div className="text-center py-3 sm:py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                <p className="text-blue-800 font-medium text-sm sm:text-base">Ready to Set Bridge</p>
                <p className="text-blue-600 text-xs sm:text-sm mt-1">
                  This will configure your L2 token to use the Celo Standard Bridge for cross-chain transfers.
                </p>
              </div>
              <button
                onClick={handleSetBridge}
                disabled={isProcessing || !address}
                className="w-full bg-black text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base
                           hover:bg-gray-800 transition-colors disabled:opacity-50 
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Setting Bridge...
                  </>
                ) : (
                  'Set Bridge'
                )}
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-3 sm:py-4">
              <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-3 sm:mb-4">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-500 mx-auto mb-2 sm:mb-3" />
                <p className="text-green-800 font-semibold text-base sm:text-lg">
                  Bridge Setup Complete!
                </p>
                <p className="text-green-600 text-xs sm:text-sm mt-1">
                  Your token is now configured for cross-chain bridging.
                </p>
                {txHash && (
                  <a
                    href={`${EXPLORER_URLS.celo}${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 mt-2 sm:mt-3 text-xs sm:text-sm"
                  >
                    View Transaction
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </a>
                )}
              </div>
              <button
                onClick={handleGoBack}
                className="w-full bg-black text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base
                           hover:bg-gray-800 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-3 sm:py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="text-red-800 font-medium text-sm sm:text-base">Error</p>
                <p className="text-red-600 text-xs sm:text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={handleGoBack}
                className="w-full bg-black text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base
                           hover:bg-gray-800 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {error && step !== 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 mt-3 sm:mt-4">
              <p className="text-red-700 text-xs sm:text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
