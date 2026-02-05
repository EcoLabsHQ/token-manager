import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  ExternalLink,
  ArrowRight,
  Coins,
  Link2,
  Settings
} from 'lucide-react';
import {
  useAccount,
  usePublicClient,
} from 'wagmi';
import { formatUnits, getAddress } from 'viem';
import { CONTRACTS, L2_SUPERCHAIN_TOKEN_ABI } from '@/config/contracts';
import { useMigrateToEthereum } from '../hooks/useMigrateToEthereum';
import { formatNumberWithCommas } from '../lib/utils';

// Explorer URLs
const EXPLORER_URLS = {
  ethereum: 'https://sepolia.etherscan.io/tx/',
  celo: 'https://sepolia.celoscan.io/tx/',
};

// Chain icons
const EthereumIcon = () => (
  <div className="w-6 h-6 rounded-lg overflow-hidden border-[1.5px] border-white shadow-sm">
    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
  </div>
);

const CeloIcon = () => (
  <div className="w-6 h-6 rounded-lg overflow-hidden border-[1.5px] border-white shadow-sm">
    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
  </div>
);

// Migration step configuration
const MIGRATION_STEPS = [
  {
    id: 1,
    title: 'Deploy L1 Token',
    description: 'Create the token on Ethereum',
    icon: Coins,
  },
  {
    id: 2,
    title: 'Lock Supply in Bridge',
    description: 'Mint current supply to Standard Bridge',
    icon: Link2,
  },
  {
    id: 3,
    title: 'Set Remote Token',
    description: 'Link L2 token to L1 token',
    icon: Settings,
  },
  {
    id: 4,
    title: 'Configure Bridge',
    description: 'Set Standard Bridge on L2 token',
    icon: Link2,
  },
];

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  maxSupply: bigint;
  owner: string;
}

export default function MigrateCeloNative() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const l2Token = searchParams.get('l2Token');

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const { address } = useAccount();
  const l2Client = usePublicClient({ chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId });

  const {
    migrate,
    reset,
    step,
    stepNumber,
    error,
    isProcessing,
    l1TokenAddress,
    txHashes,
    l1CreationFee,
  } = useMigrateToEthereum();

  // Load token information
  useEffect(() => {
    const loadTokenInfo = async () => {
      if (!l2Token || !l2Client) return;

      setIsLoadingToken(true);
      try {
        const [name, symbol, decimals, totalSupply, maxSupply, owner] = await Promise.all([
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'name',
          }),
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'symbol',
          }),
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'decimals',
          }),
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'totalSupply',
          }),
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'maxSupply',
          }),
          l2Client.readContract({
            address: getAddress(l2Token),
            abi: L2_SUPERCHAIN_TOKEN_ABI,
            functionName: 'owner',
          }),
        ]);

        setTokenInfo({
          name: name as string,
          symbol: symbol as string,
          decimals: decimals as number,
          totalSupply: totalSupply as bigint,
          maxSupply: maxSupply as bigint,
          owner: owner as string,
        });
      } catch (err) {
        console.error('Error loading token info:', err);
      } finally {
        setIsLoadingToken(false);
      }
    };

    loadTokenInfo();
  }, [l2Token, l2Client]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleStartMigration = async () => {
    if (!tokenInfo || !l2Token) return;

    setShowConfirm(false);
    await migrate({
      l2TokenAddress: l2Token,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      totalSupply: tokenInfo.totalSupply,
      maxSupply: tokenInfo.maxSupply,
    });
  };

  const handleGoToToken = () => {
    if (l1TokenAddress && l2Token) {
      navigate(`/manage/${l1TokenAddress}?l2Token=${l2Token}&type=ethereum-enabled`);
    }
  };

  const isOwner = address && tokenInfo?.owner 
    ? address.toLowerCase() === tokenInfo.owner.toLowerCase() 
    : false;

  const formattedSupply = tokenInfo 
    ? formatNumberWithCommas(formatUnits(tokenInfo.totalSupply, tokenInfo.decimals))
    : '0';

  const formattedMaxSupply = tokenInfo 
    ? formatNumberWithCommas(formatUnits(tokenInfo.maxSupply, tokenInfo.decimals))
    : '0';

  const formattedFee = l1CreationFee 
    ? `${formatUnits(l1CreationFee, 18)} ETH`
    : '0 ETH';

  // Missing token address
  if (!l2Token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-lg text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Missing Token Information
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mb-4 sm:mb-6">
            The L2 token address is missing. Please go back and try again.
          </p>
          <button
            onClick={handleGoBack}
            className="bg-black text-white px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Loading token info
  if (isLoadingToken) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-lg text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-black mb-2">Loading Token Information...</h2>
          <p className="text-sm text-gray-500">
            Fetching token data from Celo network.
          </p>
        </div>
      </div>
    );
  }

  // Token not found
  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-lg text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Token Not Found
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            Could not load token information from the provided address.
          </p>
          <button
            onClick={handleGoBack}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-2xl w-full shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={handleGoBack}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Migrate to Ethereum
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Convert your Celo-native token to Ethereum-enabled
            </p>
          </div>
        </div>

        {/* Token Info Card */}
        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CeloIcon />
            <div>
              <h3 className="font-semibold text-gray-900">
                {tokenInfo.name} ({tokenInfo.symbol})
              </h3>
              <p className="text-xs text-gray-500">Celo-Native Token</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Current Supply</span>
              <p className="font-medium">{formattedSupply} {tokenInfo.symbol}</p>
            </div>
            <div>
              <span className="text-gray-500">Max Supply</span>
              <p className="font-medium">{formattedMaxSupply} {tokenInfo.symbol}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">L2 Address</span>
              <p className="font-mono text-xs break-all">{l2Token}</p>
            </div>
          </div>
        </div>

        {/* Migration not started - Show explanation */}
        {step === 'idle' && !showConfirm && (
          <>
            {/* What will happen */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-900">What will happen:</h3>
              <div className="space-y-3">
                {MIGRATION_STEPS.map((s, idx) => (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <s.icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{s.title}</p>
                      <p className="text-xs text-gray-500">{s.description}</p>
                    </div>
                    {idx < MIGRATION_STEPS.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fee info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-blue-800 text-sm">
                <strong>Creation Fee:</strong> {formattedFee} will be charged for deploying the L1 token.
              </p>
            </div>

            {/* Not owner warning */}
            {!isOwner && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-amber-800 text-sm">
                  ⚠️ You are not the owner of this token. Only the token owner can perform this migration.
                </p>
              </div>
            )}

            {/* Start button */}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!isOwner}
              className="w-full bg-black text-white py-3 rounded-xl font-medium
                         hover:bg-gray-800 transition-colors disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Start Migration
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Confirmation dialog */}
        {step === 'idle' && showConfirm && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2">⚠️ Confirm Migration</h4>
              <p className="text-amber-700 text-sm mb-3">
                This action will:
              </p>
              <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
                <li>Deploy a new token on Ethereum ({formattedFee})</li>
                <li>Mint {formattedSupply} {tokenInfo.symbol} to the Standard Bridge</li>
                <li>Configure your L2 token to be bridgeable</li>
              </ul>
              <p className="text-amber-800 text-sm mt-3 font-medium">
                This process cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium
                           hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartMigration}
                className="flex-1 bg-black text-white py-2.5 rounded-lg font-medium
                           hover:bg-gray-800 transition-colors"
              >
                Confirm & Start
              </button>
            </div>
          </div>
        )}

        {/* Migration in progress */}
        {isProcessing && step !== 'complete' && step !== 'error' && (
          <div className="space-y-6">
            <div className="space-y-3">
              {MIGRATION_STEPS.map((s) => {
                const isActive = s.id === stepNumber;
                const isComplete = s.id < stepNumber;
                
                return (
                  <div 
                    key={s.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-blue-50 border border-blue-200' :
                      isComplete ? 'bg-green-50 border border-green-200' :
                      'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-blue-500' :
                      isComplete ? 'bg-green-500' :
                      'bg-gray-300'
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <span className="text-white text-sm font-medium">{s.id}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${
                        isActive ? 'text-blue-800' :
                        isComplete ? 'text-green-800' :
                        'text-gray-500'
                      }`}>
                        {s.title}
                      </p>
                      <p className={`text-xs ${
                        isActive ? 'text-blue-600' :
                        isComplete ? 'text-green-600' :
                        'text-gray-400'
                      }`}>
                        {s.description}
                      </p>
                    </div>
                    {isActive && (
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        Processing...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <p className="text-center text-sm text-gray-500">
              Please confirm the transactions in your wallet. Do not close this page.
            </p>
          </div>
        )}

        {/* Migration complete */}
        {step === 'complete' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Migration Complete!</h3>
              <p className="text-gray-500 text-sm mt-1">
                Your token is now Ethereum-enabled
              </p>
            </div>

            {/* Token addresses */}
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
              <div className="flex items-center gap-2">
                <EthereumIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">L1 Token (Ethereum)</p>
                  <p className="font-mono text-xs break-all">{l1TokenAddress}</p>
                </div>
                {txHashes.deployL1 && (
                  <a
                    href={`${EXPLORER_URLS.ethereum}${txHashes.deployL1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <CeloIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">L2 Token (Celo)</p>
                  <p className="font-mono text-xs break-all">{l2Token}</p>
                </div>
              </div>
            </div>

            {/* Transaction links */}
            <div className="flex flex-wrap gap-2 justify-center text-xs">
              {txHashes.mintToBridge && (
                <a
                  href={`${EXPLORER_URLS.ethereum}${txHashes.mintToBridge}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  Mint TX <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {txHashes.setRemoteToken && (
                <a
                  href={`${EXPLORER_URLS.celo}${txHashes.setRemoteToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  SetRemoteToken TX <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {txHashes.setBridge && (
                <a
                  href={`${EXPLORER_URLS.celo}${txHashes.setBridge}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  SetBridge TX <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <button
              onClick={handleGoToToken}
              className="w-full bg-black text-white py-3 rounded-xl font-medium
                         hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              Manage Token
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Migration Failed</h3>
              <p className="text-red-600 text-sm mt-2">{error}</p>
            </div>

            {/* Show partial progress */}
            {l1TokenAddress && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> L1 token was deployed at:
                </p>
                <p className="font-mono text-xs break-all mt-1">{l1TokenAddress}</p>
                <p className="text-amber-700 text-xs mt-2">
                  You may need to manually complete the remaining steps.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium
                           hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleGoBack}
                className="flex-1 bg-black text-white py-2.5 rounded-lg font-medium
                           hover:bg-gray-800 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
