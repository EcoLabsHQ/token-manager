import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useSubgraphTokens, type TokenPair, type TokenSetupStatus } from '../hooks/useSubgraphTokens';

// Setup status badge component
const SetupStatusBadge = ({ status }: { status: TokenSetupStatus }) => {
  if (status === 'complete') return null;

  const config = {
    'pending-l2': {
      label: 'Needs L2 Token',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
    },
    'pending-bridge': {
      label: 'Needs Bridge Setup',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-200',
    },
  };

  const { label, bgColor, textColor, borderColor } = config[status];

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${bgColor} ${textColor} border ${borderColor}`}>
      <AlertCircle className="w-3 h-3" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
};

// Chain icons
const EthereumIcon = () => (
  <div className="w-4 h-4 rounded bg-[#627eea] flex items-center justify-center">
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
      <path d="M4 0L0 6.5L4 8.5L8 6.5L4 0Z" fill="white" fillOpacity="0.6" />
      <path d="M4 9.5L0 7.5L4 13L8 7.5L4 9.5Z" fill="white" />
    </svg>
  </div>
);

const CeloIcon = () => (
  <div className="w-4 h-4 rounded bg-[#fcff52] flex items-center justify-center">
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    </svg>
  </div>
);

interface AddressWithActionsProps {
  address: string;
  chain: 'ethereum' | 'celo';
  onCopy: () => void;
}

// Explorer URLs
const EXPLORER_URLS = {
  ethereum: 'https://sepolia.etherscan.io/address/',
  celo: 'https://sepolia.celoscan.io/address/',
};

const AddressWithActions = ({ address, chain, onCopy }: AddressWithActionsProps) => {
  const [copied, setCopied] = useState(false);
  const explorerUrl = `${EXPLORER_URLS[chain]}${address}`;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 group">
      <span className="text-sm text-black font-normal transition-colors duration-200 group-hover:text-gray-600">
        {address}
      </span>
      <button
        onClick={handleCopy}
        className="p-1 rounded-md transition-colors duration-150 hover:bg-gray-100 cursor-pointer"
        title="Copy address"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500 animate-in fade-in duration-200" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400 transition-colors duration-200 hover:text-gray-700" />
        )}
      </button>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded-md transition-colors duration-150 hover:bg-gray-100 cursor-pointer"
        title={`View on ${chain === 'ethereum' ? 'Etherscan' : 'Celoscan'}`}
      >
        <ExternalLink className="w-4 h-4 text-gray-400 transition-colors duration-200 hover:text-gray-700" />
      </a>
    </div>
  );
};

interface TokenTableProps {
  tokens: TokenPair[];
  onManage: (token: TokenPair) => void;
  onCompleteSetup: (token: TokenPair) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const TokenTable = ({ tokens, onManage, onCompleteSetup, isLoading, onRefresh: _onRefresh }: TokenTableProps) => {
  const handleCopy = (text: string) => {
    if (text) navigator.clipboard.writeText(text);
  }

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-white flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <p className="text-gray-500 text-sm font-medium">Loading tokens from subgraph...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-shadow duration-300 hover:shadow-md">
      {/* Table Header */}
      <div className="bg-gray-50/80 border-b border-gray-200 flex items-center p-3">
        <div className="w-44 text-gray-500 text-sm font-medium">Name</div>
        <div className="w-44 text-gray-500 text-sm font-medium">Ticker</div>
        <div className="flex-1 text-gray-500 text-sm font-medium">Type</div>
        <div className="flex-1 text-gray-500 text-sm font-medium">Max Supply</div>
        <div className="flex-1 text-gray-500 text-sm font-medium">Address (L1)</div>
        <div className="flex-1 text-gray-500 text-sm font-medium">Address (L2)</div>
        <div className="w-20 text-gray-500 text-sm font-medium">Action</div>
      </div>

      {/* Table Body */}
      {tokens.map((token, index) => {
        const isIncomplete = token.setupStatus !== 'complete';
        
        return (
        <div
          key={token.id}
          className={`bg-white flex items-center h-13 px-3 border-b border-gray-100 last:border-b-0 
                     transition-all duration-200 ease-out
                     hover:bg-linear-to-r hover:from-gray-50 hover:to-white
                     hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]
                     group cursor-default
                     ${isIncomplete ? 'bg-amber-50/50' : ''}`}
          style={{
            animationDelay: `${index * 50}ms`,
          }}
        >
          {/* Name with Status Badge */}
          <div className="w-44">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-black font-medium transition-colors duration-200 group-hover:text-gray-900">
                {token.name}
              </span>
              <SetupStatusBadge status={token.setupStatus} />
            </div>
          </div>

          {/* Ticker */}
          <div className="w-44">
            <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded transition-all duration-200 group-hover:bg-gray-200 group-hover:text-gray-800">
              {token.symbol}
            </span>
          </div>

          {/* Type */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-black font-normal">
              {token.type === 'ethereum-enabled' ? 'Ethereum Enabled' : 'Celo-Native'}
            </span>
            <div className="flex items-center transition-transform duration-200 group-hover:translate-x-0.5">
              {token.type === 'ethereum-enabled' ? (
                <div className="flex items-center">
                  <EthereumIcon />
                  <div className="-ml-1">
                    <CeloIcon />
                  </div>
                </div>
              ) : (
                <CeloIcon />
              )}
            </div>
          </div>

          {/* Max Supply */}
          <div className="flex-1">
            <span className="text-sm text-black font-normal tabular-nums">{token.maxSupplyFormatted}</span>
          </div>

          {/* Address L1 */}
          <div className="flex-1">
            {token.addressL1 ? (
              <AddressWithActions
                address={token.addressL1}
                chain="ethereum"
                onCopy={() => handleCopy(token.addressL1 || '')}
              />
            ) : (
              <span className="text-sm text-gray-400 font-normal">—</span>
            )}
          </div>

          {/* Address L2 */}
          <div className="flex-1">
            {token.addressL2 ? (
              <AddressWithActions
                address={token.addressL2}
                chain="celo"
                onCopy={() => handleCopy(token.addressL2 || '')}
              />
            ) : (
              <span className="text-sm text-gray-400 font-normal">—</span>
            )}
          </div>

          {/* Action */}
          <div className="w-20">
            {isIncomplete ? (
              <button
                onClick={() => onCompleteSetup(token)}
                className="bg-orange-500 text-white text-sm font-medium h-7 px-2 rounded-lg 
                           transition-colors duration-150 cursor-pointer whitespace-nowrap
                           hover:bg-orange-600
                           active:scale-[0.98]
                           focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              >
                Setup
              </button>
            ) : (
              <button
                onClick={() => onManage(token)}
                className="bg-black text-white text-sm font-medium h-7 px-2.5 rounded-lg 
                           transition-colors duration-150 cursor-pointer
                           hover:bg-gray-800
                           active:scale-[0.98]
                           focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Manage
              </button>
            )}
          </div>
        </div>
        );
      })}

      {/* Empty state */}
      {tokens.length === 0 && (
        <div className="bg-white flex items-center justify-center h-40">
          <div className="text-center animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-gray-400"
              >
                <path
                  d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">No tokens created yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Create your first token to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


export default function Dashboard() {
  const navigate = useNavigate();
  const { tokens, isLoading, l1TokenCount, l2TokenCount, refetch } = useSubgraphTokens();

  const handleManage = (token: TokenPair) => {
    // Navigate to token manager using token address as the identifier
    navigate(`/manage/${token.address}`);
  };

  const handleCompleteSetup = (token: TokenPair) => {
    // Navigate to setup completion flow with the token info
    if (token.setupStatus === 'pending-l2') {
      // Need to create L2 token - go to create with L1 token pre-filled
      navigate(`/create?step=l2&l1Token=${token.addressL1}`);
    } else if (token.setupStatus === 'pending-bridge') {
      // Need to set bridge - go to bridge setup
      navigate(`/setup-bridge?l1Token=${token.addressL1}&l2Token=${token.addressL2}`);
    }
  };

  const handleCreateToken = () => {
    navigate('/create');
  };

  return (
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-6 animate-fade-in">
      {/* My Tokens Section */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-5 shadow-sm transition-shadow duration-300 hover:shadow-md animate-slide-up">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-black tracking-tight">
              My Tokens
            </h2>
            {!isLoading && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                {l1TokenCount > 0 && l2TokenCount > 0 && (
                  <span className="text-gray-400 ml-1">
                    ({l1TokenCount} L1, {l2TokenCount} L2)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isLoading}
              className="text-gray-500 text-sm font-medium h-9 px-3 rounded-lg 
                         flex items-center gap-2 cursor-pointer
                         transition-all duration-150
                         hover:bg-gray-100 hover:text-gray-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              title="Refresh tokens"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateToken}
              className="bg-black text-white text-sm font-medium h-9 px-4 rounded-lg 
                         flex items-center gap-2 cursor-pointer
                         transition-all duration-150
                         hover:bg-gray-800
                         active:scale-[0.98]
                         focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                         group"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="transition-transform duration-150"
              >
                <path
                  d="M8 3.33334V12.6667"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.33334 8H12.6667"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Create Token</span>
            </button>
          </div>
        </div>

        {/* Token Table */}
        <TokenTable tokens={tokens} onManage={handleManage} onCompleteSetup={handleCompleteSetup} isLoading={isLoading} onRefresh={refetch} />
      </div>
    </div>
  );
}
