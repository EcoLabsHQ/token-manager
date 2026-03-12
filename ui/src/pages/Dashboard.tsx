import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { Copy, ExternalLink, Check, Loader2, RefreshCw, AlertCircle, UserCheck, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useSubgraphTokens, type TokenPair, type TokenSetupStatus } from '../hooks/useSubgraphTokens';
import { usePendingOwnershipTransfers, type PendingOwnershipTransfer } from '../hooks/usePendingOwnershipTransfers';
import { useAcceptOwnership } from '../hooks/useAcceptOwnership';
import { findLogoBatch } from '../hooks/useTokenLogo';
import { CONTRACTS } from '@/config/contracts';
import { MultistepProgressModal, type MultistepProgressStep } from '../components';

// Steps for the accept ownership modal
const ACCEPT_OWNERSHIP_STEPS: MultistepProgressStep[] = [
  {
    title: 'Accept on Ethereum',
    description: 'Accepting ownership on L1',
    chain: 'ethereum',
  },
  {
    title: 'Accept on Celo',
    description: 'Accepting ownership on L2',
    chain: 'celo',
  },
];

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

// Generate a consistent color based on string hash
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate pastel-ish colors
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 75%)`;
};

const stringToColorDark = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 35%)`;
};

// Token Logo component with fallback to first letter
const TokenLogo = ({ logoUrl, name, symbol }: { logoUrl?: string; name: string; symbol: string }) => {
  const [hasError, setHasError] = useState(false);
  const firstLetter = (name || symbol || '?').charAt(0).toUpperCase();
  const bgColor = stringToColor(name || symbol || '');
  const textColor = stringToColorDark(name || symbol || '');
  
  if (!logoUrl || hasError) {
    return (
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/20"
        style={{ backgroundColor: bgColor }}
      >
        <span className="text-sm font-bold" style={{ color: textColor }}>{firstLetter}</span>
      </div>
    );
  }
  
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100">
      <img 
        src={logoUrl} 
        alt={`${name} logo`}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

// Chain icons using PNG images
const EthereumIcon = () => (
  <div className="w-4 h-4 rounded overflow-hidden">
    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
  </div>
);

const CeloIcon = () => (
  <div className="w-4 h-4 rounded overflow-hidden">
    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
  </div>
);

interface AddressWithActionsProps {
  address: string;
  chain: 'ethereum' | 'celo';
  onCopy: () => void;
}

// Explorer URLs
const EXPLORER_URLS = {
  ethereum: 'https://etherscan.io/address/',
  celo: 'https://celoscan.io/address/',
};

// Truncate address for display
const truncateAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const truncateAddressLong = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 10)}...${address.slice(-4)}`;
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
    <div className="flex items-center gap-0.5">
      <span className="text-sm text-black font-mono" title={address}>
        {truncateAddress(address)}
      </span>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded transition-colors duration-150 hover:bg-gray-100 cursor-pointer"
        title="Copy address"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
        )}
      </button>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-0.5 rounded transition-colors duration-150 hover:bg-gray-100 cursor-pointer"
        title={`View on ${chain === 'ethereum' ? 'Etherscan' : 'Celoscan'}`}
      >
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
      </a>
    </div>
  );
};

interface MergedAddressWithActionsProps {
  addressL1?: string;
  addressL2?: string;
  onCopy: () => void;
}

const MergedAddressWithActions = ({ addressL1, addressL2, onCopy }: MergedAddressWithActionsProps) => {
  const [copied, setCopied] = useState(false);
  const displayAddress = addressL1 || addressL2 || '';

  if (!displayAddress) return <span className="text-sm text-gray-400">—</span>;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-sm text-black font-mono" title={displayAddress}>
        {truncateAddressLong(displayAddress)}
      </span>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded transition-colors duration-150 hover:bg-gray-100 cursor-pointer"
        title="Copy address"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
        )}
      </button>
      {addressL1 && (
        <a
          href={`${EXPLORER_URLS.ethereum}${addressL1}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-0.5 rounded transition-colors duration-150 hover:bg-gray-100 cursor-pointer flex items-center gap-0.5"
          title="View on Etherscan (L1)"
        >
          <div className="w-3 h-3 rounded overflow-hidden">
            <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
          </div>
          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-700" />
        </a>
      )}
      {addressL2 && (
        <a
          href={`${EXPLORER_URLS.celo}${addressL2}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-0.5 rounded transition-colors duration-150 hover:bg-gray-100 cursor-pointer flex items-center gap-0.5"
          title="View on Celoscan (L2)"
        >
          <div className="w-3 h-3 rounded overflow-hidden">
            <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
          </div>
          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-700" />
        </a>
      )}
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

type SortColumn = 'holders' | 'transfers' | 'bridges';
type SortDir = 'asc' | 'desc';

const SortableColHeader = ({
  label,
  col,
  sortColumn,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortColumn;
  sortColumn: SortColumn | null;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
}) => {
  const active = sortColumn === col;
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-0.5 group select-none cursor-pointer"
    >
      <span className={`text-xs font-medium uppercase tracking-wide transition-colors ${
        active ? 'text-black' : 'text-gray-500 group-hover:text-gray-700'
      }`}>{label}</span>
      {active ? (
        sortDir === 'asc'
          ? <ChevronUp className="w-3.5 h-3.5 text-black shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-black shrink-0" />
      ) : (
        <ArrowUpDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 shrink-0" />
      )}
    </button>
  );
};

const TokenTable = ({ tokens, onManage, onCompleteSetup, isLoading, onRefresh: _onRefresh }: TokenTableProps) => {
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('transfers');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  const handleCopy = (text: string) => {
    if (text) navigator.clipboard.writeText(text);
  }
  
  // Fetch logos for all tokens (tries multiple extensions: png, jpg, webp, svg)
  useEffect(() => {
    if (tokens.length === 0) return;
    
    const tokensToFetch = tokens.map(token => ({
      chainId: token.addressL2 
        ? CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId 
        : CONTRACTS.L1_TOKEN_FACTORY.chainId,
      address: token.addressL2 || token.address,
    }));
    
    findLogoBatch(tokensToFetch).then(setTokenLogos);
  }, [tokens]);
  
  // Helper to get logo URL for a token
  const getLogoUrl = (token: TokenPair): string | undefined => {
    const address = (token.addressL2 || token.address).toLowerCase();
    return tokenLogos[address];
  };

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

  const sorted = sortColumn
    ? [...tokens].sort((a, b) => {
        let aVal = 0, bVal = 0;
        if (sortColumn === 'holders') { aVal = a.totalUniqueHolders; bVal = b.totalUniqueHolders; }
        else if (sortColumn === 'transfers') { aVal = a.totalTransfers; bVal = b.totalTransfers; }
        else if (sortColumn === 'bridges') { aVal = a.totalBridges; bVal = b.totalBridges; }
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      })
    : tokens;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Desktop — horizontally scrollable */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="min-w-[1060px]">
          {/* Desktop Header */}
          <div className="bg-gray-50/80 border-b border-gray-200 flex items-center px-4 py-3">
            <div className="w-[196px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Name</div>
            <div className="w-[80px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Ticker</div>
            <div className="w-[120px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Type</div>
            <div className="w-[110px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Total Supply</div>
            <div className="w-[96px] shrink-0 flex justify-end">
              <SortableColHeader label="Holders" col="holders" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
            </div>
            <div className="w-[96px] shrink-0 flex justify-end">
              <SortableColHeader label="Txns" col="transfers" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
            </div>
            <div className="w-[96px] shrink-0 flex justify-end">
              <SortableColHeader label="Bridges" col="bridges" sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} />
            </div>
            <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide pl-4 min-w-[180px]">Address</div>
            <div className="w-[80px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
          </div>

          {/* Desktop Rows */}
          {sorted.map((token) => {
            const isIncomplete = token.setupStatus !== 'complete';
            const logoUrl = getLogoUrl(token);
            return (
              <div
                key={token.id}
                className={`flex items-center min-h-[52px] px-4 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 bg-white ${
                  isIncomplete ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="w-[196px] shrink-0 flex items-center gap-2">
                  <TokenLogo logoUrl={logoUrl} name={token.name} symbol={token.symbol} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm text-black font-medium truncate" title={token.name}>{token.name}</span>
                    <SetupStatusBadge status={token.setupStatus} />
                  </div>
                </div>
                <div className="w-[80px] shrink-0">
                  <span className="text-xs text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{token.symbol}</span>
                </div>
                <div className="w-[120px] shrink-0 flex items-center gap-1.5">
                  {token.type === 'ethereum-enabled' ? (
                    <div className="flex items-center"><EthereumIcon /><div className="-ml-1"><CeloIcon /></div></div>
                  ) : <CeloIcon />}
                  <span className="text-xs text-gray-600">{token.type === 'ethereum-enabled' ? 'ETH + Celo' : 'Celo-Native'}</span>
                </div>
                <div className="w-[110px] shrink-0 text-right">
                  <span className="text-sm text-black tabular-nums">{token.totalSupplyFormatted}</span>
                </div>
                <div className="w-[96px] shrink-0 text-right">
                  <span className={`text-sm tabular-nums ${sortColumn === 'holders' ? 'text-black font-medium' : 'text-gray-700'}`}>{token.totalUniqueHolders.toLocaleString()}</span>
                </div>
                <div className="w-[96px] shrink-0 text-right">
                  <span className={`text-sm tabular-nums ${sortColumn === 'transfers' ? 'text-black font-medium' : 'text-gray-700'}`}>{token.totalTransfers.toLocaleString()}</span>
                </div>
                <div className="w-[96px] shrink-0 text-right">
                  <span className={`text-sm tabular-nums ${sortColumn === 'bridges' ? 'text-black font-medium' : 'text-gray-700'}`}>{token.totalBridges.toLocaleString()}</span>
                </div>
                <div className="flex-1 pl-4 min-w-[180px]">
                  <MergedAddressWithActions
                    addressL1={token.addressL1}
                    addressL2={token.addressL2}
                    onCopy={() => handleCopy(token.addressL1 || token.addressL2 || '')}
                  />
                </div>
                <div className="w-[80px] shrink-0 text-right">
                  {isIncomplete ? (
                    <button
                      onClick={() => onCompleteSetup(token)}
                      className="bg-orange-500 text-white text-xs font-medium h-7 px-3 rounded-lg hover:bg-orange-600 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Setup
                    </button>
                  ) : (
                    <button
                      onClick={() => onManage(token)}
                      className="bg-black text-white text-xs font-medium h-7 px-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state (desktop) */}
      {tokens.length === 0 && (
        <div className="hidden lg:flex bg-white items-center justify-center h-40">
          <div className="text-center animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">No tokens created yet</p>
            <p className="text-gray-400 text-xs mt-1">Create your first token to get started</p>
          </div>
        </div>
      )}

      {/* Mobile table */}
      <div className="lg:hidden">
        <div className="bg-gray-50/80 border-b border-gray-200 flex items-center px-3 py-2.5">
          <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide">Name</div>
          <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide">Ticker</div>
          <div className="w-24 text-gray-500 text-xs font-medium uppercase tracking-wide">Type</div>
          <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
        </div>
        {sorted.map((token) => {
          const isIncomplete = token.setupStatus !== 'complete';
          const logoUrl = getLogoUrl(token);
          return (
            <div
              key={token.id}
              className={`bg-white flex items-center min-h-12 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                isIncomplete ? 'bg-amber-50/50' : ''
              }`}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <TokenLogo logoUrl={logoUrl} name={token.name} symbol={token.symbol} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm text-black font-medium truncate">{token.name}</span>
                  <SetupStatusBadge status={token.setupStatus} />
                </div>
              </div>
              <div className="w-16 shrink-0">
                <span className="text-xs text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{token.symbol}</span>
              </div>
              <div className="w-24 flex items-center gap-1 shrink-0">
                {token.type === 'ethereum-enabled' ? (
                  <div className="flex items-center"><EthereumIcon /><div className="-ml-1"><CeloIcon /></div></div>
                ) : <CeloIcon />}
                <span className="text-xs text-gray-600 hidden sm:inline">{token.type === 'ethereum-enabled' ? 'ETH' : 'Celo'}</span>
              </div>
              <div className="w-16 shrink-0 text-right">
                {isIncomplete ? (
                  <button onClick={() => onCompleteSetup(token)} className="bg-orange-500 text-white text-xs font-medium h-7 px-2.5 rounded-lg hover:bg-orange-600 cursor-pointer">Setup</button>
                ) : (
                  <button onClick={() => onManage(token)} className="bg-black text-white text-xs font-medium h-7 px-2.5 rounded-lg hover:bg-gray-800 cursor-pointer">Manage</button>
                )}
              </div>
            </div>
          );
        })}
        {tokens.length === 0 && (
          <div className="bg-white flex items-center justify-center h-40">
            <div className="text-center animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">No tokens created yet</p>
              <p className="text-gray-400 text-xs mt-1">Create your first token to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Pending Ownership Transfers Table Component
interface PendingTransfersTableProps {
  transfers: PendingOwnershipTransfer[];
  onAccept: (transfer: PendingOwnershipTransfer) => void;
  isLoading?: boolean;
  processingTokenId?: string | null;
}

const PendingTransfersTable = ({ transfers, onAccept, isLoading, processingTokenId }: PendingTransfersTableProps) => {
  const handleCopy = (text: string) => {
    if (text) navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-white flex items-center justify-center h-32">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <p className="text-gray-500 text-sm font-medium">Loading pending transfers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="bg-purple-50/80 border-b border-purple-200 flex items-center px-4 py-3">
        <div className="flex-1 text-purple-600 text-xs font-medium uppercase tracking-wide">Token</div>
        <div className="w-[100px] shrink-0 text-purple-600 text-xs font-medium uppercase tracking-wide">Chain</div>
        <div className="w-[180px] shrink-0 text-purple-600 text-xs font-medium uppercase tracking-wide hidden lg:block">From</div>
        <div className="w-[180px] shrink-0 text-purple-600 text-xs font-medium uppercase tracking-wide hidden lg:block">Token Address</div>
        <div className="w-[100px] shrink-0 text-purple-600 text-xs font-medium uppercase tracking-wide text-right">Action</div>
      </div>

      {/* Table Body */}
      {transfers.map((transfer) => (
        <div
          key={transfer.id}
          className="bg-white flex items-center min-h-[52px] px-4 py-3 border-b border-purple-100 last:border-b-0 
                     hover:bg-purple-50/50"
        >
          {/* Token Name & Symbol */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-black font-medium truncate" title={transfer.tokenName}>
                  {transfer.tokenName}
                </span>
                {transfer.isEthereumEnabled && (
                  <span className="text-[10px] bg-gradient-to-r from-blue-100 to-green-100 text-gray-600 px-1.5 py-0.5 rounded-full border border-blue-200/50">
                    Dual Chain
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 font-mono">
                {transfer.tokenSymbol}
              </span>
            </div>
          </div>

          {/* Chain */}
          <div className="w-[100px] shrink-0 flex items-center gap-1.5">
            {transfer.isEthereumEnabled ? (
              <>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded overflow-hidden">
                    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-4 h-4 rounded overflow-hidden -ml-1.5">
                    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="text-xs text-gray-600">Both</span>
              </>
            ) : transfer.chain === 'ethereum' ? (
              <>
                <div className="w-4 h-4 rounded overflow-hidden">
                  <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-gray-600">Ethereum</span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 rounded overflow-hidden">
                  <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-gray-600">Celo</span>
              </>
            )}
          </div>

          {/* From Address */}
          <div className="w-[180px] shrink-0 hidden lg:block">
            <AddressWithActions
              address={transfer.previousOwner}
              chain={transfer.chain as 'ethereum' | 'celo'}
              onCopy={() => handleCopy(transfer.previousOwner)}
            />
          </div>

          {/* Token Address */}
          <div className="w-[180px] shrink-0 hidden lg:block">
            {transfer.isEthereumEnabled ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">L1:</span>
                  <AddressWithActions
                    address={transfer.l1TokenAddress || transfer.tokenAddress}
                    chain="ethereum"
                    onCopy={() => handleCopy(transfer.l1TokenAddress || transfer.tokenAddress)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">L2:</span>
                  <AddressWithActions
                    address={transfer.l2TokenAddress || ''}
                    chain="celo"
                    onCopy={() => handleCopy(transfer.l2TokenAddress || '')}
                  />
                </div>
              </div>
            ) : (
              <AddressWithActions
                address={transfer.tokenAddress}
                chain={transfer.chain as 'ethereum' | 'celo'}
                onCopy={() => handleCopy(transfer.tokenAddress)}
              />
            )}
          </div>

          {/* Action */}
          <div className="w-[100px] shrink-0 text-right">
            <button
              onClick={() => onAccept(transfer)}
              disabled={processingTokenId === transfer.id}
              className="bg-purple-600 text-white text-xs font-medium h-7 px-3 rounded-lg 
                         flex items-center gap-1.5 ml-auto cursor-pointer
                         hover:bg-purple-700 transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processingTokenId === transfer.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Accept
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};


function ConnectWalletPrompt() {
  const { open } = useAppKit();
  return (
    <div className="bg-gray-100 flex flex-col flex-1 items-center justify-center min-h-0 w-full p-6 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 sm:p-12 flex flex-col items-center gap-5 shadow-sm max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-black tracking-tight">Connect your wallet</h2>
          <p className="text-sm text-gray-500">Connect your wallet to see your tokens</p>
        </div>
        <button
          onClick={() => open()}
          className="bg-black text-white text-sm font-medium h-10 px-6 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer w-full"
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useAppKitAccount();
  const { tokens, isLoading, l1TokenCount, l2TokenCount, refetch } = useSubgraphTokens();
  const { pendingTransfers, isLoading: isPendingLoading, refetch: refetchPending } = usePendingOwnershipTransfers();
  const { 
    acceptOwnership, 
    processingTokenId,
    isModalOpen,
    currentStep,
    isSwitchingChain,
  } = useAcceptOwnership();
  const [hideIncomplete, setHideIncomplete] = useState(false);
  const [acceptedTransferIds, setAcceptedTransferIds] = useState<Set<string>>(new Set());

  // Auto-refetch when coming from token creation (subgraph may need time to index)
  useEffect(() => {
    const state = location.state as { fromTokenCreation?: boolean } | null;
    if (state?.fromTokenCreation) {
      // Clear the state to prevent repeated refetches
      window.history.replaceState({}, document.title);
      // Refetch immediately and then again after delays to catch subgraph updates
      refetch();
      refetchPending();
      const timer1 = setTimeout(() => refetch(), 3000);
      const timer2 = setTimeout(() => refetch(), 8000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [location.state, refetch, refetchPending]);

  // Filter tokens based on hideIncomplete setting
  const filteredTokens = hideIncomplete 
    ? tokens.filter(t => t.setupStatus === 'complete')
    : tokens;
  
  const incompleteCount = tokens.filter(t => t.setupStatus !== 'complete').length;

  const handleManage = (token: TokenPair) => {
    // Navigate to token manager using token address as the identifier
    // For ethereum-enabled tokens, also pass L2 address for dual management
    if (token.type === 'ethereum-enabled' && token.addressL1 && token.addressL2) {
      navigate(`/manage/${token.addressL1}?l2Token=${token.addressL2}&type=ethereum-enabled`);
    } else {
      navigate(`/manage/${token.address}`);
    }
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

  const handleAcceptOwnership = async (transfer: PendingOwnershipTransfer) => {
    const result = await acceptOwnership(transfer);
    if (result.success) {
      // Optimistically remove the transfer so the UI updates immediately,
      // before the subgraph has a chance to re-index the event.
      setAcceptedTransferIds(prev => new Set([...prev, transfer.id]));
      // Also remove the paired transfer ID if it exists (Ethereum Enabled tokens)
      if (transfer.pairedTransfer) {
        setAcceptedTransferIds(prev => new Set([...prev, transfer.pairedTransfer!.id]));
      }
      // Refresh tokens list (new owner should appear in My Tokens)
      refetch();
      // Delayed refetches to sync once the subgraph indexes the event
      const t1 = setTimeout(() => refetchPending(), 5000);
      const t2 = setTimeout(() => refetchPending(), 12000);
      const t3 = setTimeout(() => refetchPending(), 25000);
      // Cleanup timers if component unmounts (not critical but clean)
      setTimeout(() => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }, 30000);
    } else {
      // Could add toast notification here for error
      console.error('Failed to accept ownership:', result.error);
    }
  };

  const handleCreateToken = () => {
    navigate('/create');
  };

  // Hide transfers that have been accepted optimistically (subgraph may lag behind)
  const visiblePendingTransfers = pendingTransfers.filter(t => !acceptedTransferIds.has(t.id));

  if (!isConnected) return <ConnectWalletPrompt />;

  return (
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-3 sm:p-6 animate-fade-in gap-4 sm:gap-6">
      {/* Pending Ownership Transfers Section */}
      {visiblePendingTransfers.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-4 sm:gap-5 shadow-sm transition-shadow duration-300 hover:shadow-md animate-slide-up border-l-4 border-purple-500">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
                  Pending Ownership Transfers
                </h2>
              </div>
              {!isPendingLoading && (
                <span className="text-xs sm:text-sm text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                  {visiblePendingTransfers.length} pending
                </span>
              )}
            </div>
            <button
              onClick={refetchPending}
              disabled={isPendingLoading}
              className="text-purple-500 text-sm font-medium h-8 sm:h-9 px-2 sm:px-3 rounded-lg 
                         flex items-center gap-2 cursor-pointer
                         transition-all duration-150
                         hover:bg-purple-50 hover:text-purple-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh pending transfers"
            >
              <RefreshCw className={`w-4 h-4 ${isPendingLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <p className="text-sm text-gray-600">
            These tokens have been offered to you. Accept ownership to add them to your tokens.
          </p>

          {/* Pending Transfers Table */}
          <PendingTransfersTable 
            transfers={visiblePendingTransfers} 
            onAccept={handleAcceptOwnership} 
            isLoading={isPendingLoading}
            processingTokenId={processingTokenId}
          />
        </div>
      )}

      {/* My Tokens Section */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-4 sm:gap-5 shadow-sm transition-shadow duration-300 hover:shadow-md animate-slide-up">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
              My Tokens
            </h2>
            {!isLoading && (
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
                {l1TokenCount > 0 && l2TokenCount > 0 && (
                  <span className="text-gray-400 ml-1 hidden sm:inline">
                    ({l1TokenCount} L1, {l2TokenCount} L2)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Hide incomplete toggle */}
            {incompleteCount > 0 && (
              <button
                onClick={() => setHideIncomplete(!hideIncomplete)}
                className={`text-xs font-medium h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all duration-150
                  ${hideIncomplete 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                title={hideIncomplete ? 'Show incomplete tokens' : 'Hide incomplete tokens'}
              >
                {hideIncomplete ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="hidden sm:inline">Show {incompleteCount} hidden</span>
                    <span className="sm:hidden">{incompleteCount}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    <span className="hidden sm:inline">Hide {incompleteCount} incomplete</span>
                    <span className="sm:hidden">{incompleteCount}</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={refetch}
              disabled={isLoading}
              className="text-gray-500 text-sm font-medium h-8 sm:h-9 px-2 sm:px-3 rounded-lg 
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
              className="bg-black text-white text-xs sm:text-sm font-medium h-8 sm:h-9 px-3 sm:px-4 rounded-lg 
                         flex items-center gap-1.5 sm:gap-2 cursor-pointer
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
                className="transition-transform duration-150 w-3.5 h-3.5 sm:w-4 sm:h-4"
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
              <span className="hidden xs:inline">Create Token</span>
              <span className="xs:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Token Table */}
        <TokenTable 
          tokens={filteredTokens} 
          onManage={handleManage} 
          onCompleteSetup={handleCompleteSetup} 
          isLoading={isLoading} 
          onRefresh={refetch}
        />
      </div>

      {/* Accept Ownership Progress Modal */}
      <MultistepProgressModal
        title="Accepting Ownership"
        steps={ACCEPT_OWNERSHIP_STEPS}
        currentStep={currentStep}
        isOpen={isModalOpen}
        estimatedTime="1-2 min"
        isSwitchingChain={isSwitchingChain}
      />
    </div>
  );
}
