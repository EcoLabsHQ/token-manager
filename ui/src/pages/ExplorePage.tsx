import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Check, Loader2, RefreshCw, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useAllSubgraphTokens } from '../hooks/useAllSubgraphTokens';
import { findLogoBatch } from '../hooks/useTokenLogo';
import { CONTRACTS } from '@/config/contracts';
import type { TokenPair } from '../hooks/useSubgraphTokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 75%)`;
};
const stringToColorDark = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 35%)`;
};

const TokenLogo = ({ logoUrl, name, symbol }: { logoUrl?: string; name: string; symbol: string }) => {
  const [hasError, setHasError] = useState(false);
  const first = (name || symbol || '?').charAt(0).toUpperCase();
  if (!logoUrl || hasError) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/20" style={{ backgroundColor: stringToColor(name || symbol) }}>
        <span className="text-sm font-bold" style={{ color: stringToColorDark(name || symbol) }}>{first}</span>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100">
      <img src={logoUrl} alt={`${name} logo`} className="w-full h-full object-cover" onError={() => setHasError(true)} />
    </div>
  );
};

const EthereumIcon = () => (
  <div className="w-4 h-4 rounded overflow-hidden shrink-0">
    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
  </div>
);
const CeloIcon = () => (
  <div className="w-4 h-4 rounded overflow-hidden shrink-0">
    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
  </div>
);

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const truncateAddressLong = (addr: string) => addr ? `${addr.slice(0, 10)}...${addr.slice(-4)}` : '';

const EXPLORER_URLS = { ethereum: 'https://etherscan.io/address/', celo: 'https://celoscan.io/address/' };

const MergedAddressWithActions = ({ addressL1, addressL2 }: { addressL1?: string; addressL2?: string }) => {
  const [copied, setCopied] = useState(false);
  const displayAddress = addressL1 || addressL2 || '';
  if (!displayAddress) return <span className="text-sm text-gray-400">—</span>;
  const handleCopy = () => {
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-sm text-black font-mono" title={displayAddress}>{truncateAddressLong(displayAddress)}</span>
      <button onClick={handleCopy} className="p-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />}
      </button>
      {addressL1 && (
        <a href={`${EXPLORER_URLS.ethereum}${addressL1}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-0.5" title="View on Etherscan (L1)">
          <div className="w-3 h-3 rounded overflow-hidden"><img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" /></div>
          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-700" />
        </a>
      )}
      {addressL2 && (
        <a href={`${EXPLORER_URLS.celo}${addressL2}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-0.5" title="View on Celoscan (L2)">
          <div className="w-3 h-3 rounded overflow-hidden"><img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" /></div>
          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-700" />
        </a>
      )}
    </div>
  );
};

// ─── Token Table ─────────────────────────────────────────────────────────────

type SortColumn = 'holders' | 'transfers' | 'bridges';
type SortDir = 'asc' | 'desc';

const SortableColHeader = ({
  label,
  col,
  sortColumn,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  col: SortColumn;
  sortColumn: SortColumn | null;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
  className?: string;
}) => {
  const active = sortColumn === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 group select-none cursor-pointer ${className}`}
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

const ExploreTokenTable = ({
  tokens,
  onView,
  isLoading,
  tokenLogos,
  sortColumn,
  sortDir,
  onSort,
}: {
  tokens: TokenPair[];
  onView: (token: TokenPair) => void;
  isLoading?: boolean;
  tokenLogos: Record<string, string>;
  sortColumn: SortColumn | null;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
}) => {
  const getLogoUrl = (token: TokenPair) => {
    const address = (token.addressL2 || token.address).toLowerCase();
    return tokenLogos[address];
  };

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-white flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <p className="text-gray-500 text-sm font-medium">Loading tokens…</p>
          </div>
        </div>
      </div>
    );
  }

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
              <SortableColHeader label="Holders" col="holders" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
            </div>
            <div className="w-[96px] shrink-0 flex justify-end">
              <SortableColHeader label="Txns" col="transfers" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
            </div>
            <div className="w-[96px] shrink-0 flex justify-end">
              <SortableColHeader label="Bridges" col="bridges" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
            </div>
            <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide pl-4 min-w-[180px]">Address</div>
            <div className="w-[76px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
          </div>

          {/* Desktop Rows */}
          {tokens.map(token => {
            const logoUrl = getLogoUrl(token);
            return (
              <div key={token.id} className="flex items-center min-h-[52px] px-4 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 bg-white">
                <div className="w-[196px] shrink-0 flex items-center gap-2">
                  <TokenLogo logoUrl={logoUrl} name={token.name} symbol={token.symbol} />
                  <span className="text-sm text-black font-medium truncate" title={token.name}>{token.name}</span>
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
                  <MergedAddressWithActions addressL1={token.addressL1} addressL2={token.addressL2} />
                </div>
                <div className="w-[76px] shrink-0 text-right">
                  <button onClick={() => onView(token)} className="bg-black text-white text-xs font-medium h-7 px-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors">
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tokens.length === 0 && (
        <div className="bg-white flex items-center justify-center h-40">
          <p className="text-sm text-gray-500">No tokens found</p>
        </div>
      )}

      {/* Mobile table */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="bg-gray-50/80 border-b border-gray-200 flex items-center px-3 py-2.5">
          <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide">Name</div>
          <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide">Ticker</div>
          <div className="w-24 text-gray-500 text-xs font-medium uppercase tracking-wide">Type</div>
          <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
        </div>
        {tokens.map(token => {
          const logoUrl = getLogoUrl(token);
          return (
            <div key={token.id} className="bg-white flex items-center min-h-12 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <TokenLogo logoUrl={logoUrl} name={token.name} symbol={token.symbol} />
                <span className="text-sm text-black font-medium truncate">{token.name}</span>
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
                <button onClick={() => onView(token)} className="bg-black text-white text-xs font-medium h-7 px-2.5 rounded-lg hover:bg-gray-800 cursor-pointer">
                  View
                </button>
              </div>
            </div>
          );
        })}
        {tokens.length === 0 && (
          <div className="bg-white flex items-center justify-center h-40">
            <p className="text-sm text-gray-500">No tokens found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();
  const { tokens, isLoading, refetch } = useAllSubgraphTokens();
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
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

  // Fetch logos
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

  const filtered = tokens.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      (t.addressL1 || '').toLowerCase().includes(q) ||
      (t.addressL2 || '').toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  });

  const sorted = sortColumn
    ? [...filtered].sort((a, b) => {
        let aVal = 0;
        let bVal = 0;
        if (sortColumn === 'holders') { aVal = a.totalUniqueHolders; bVal = b.totalUniqueHolders; }
        else if (sortColumn === 'transfers') { aVal = a.totalTransfers; bVal = b.totalTransfers; }
        else if (sortColumn === 'bridges') { aVal = a.totalBridges; bVal = b.totalBridges; }
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      })
    : filtered;

  const handleView = (token: TokenPair) => {
    if (token.type === 'ethereum-enabled' && token.addressL1 && token.addressL2) {
      navigate(`/manage/${token.addressL1}?l2Token=${token.addressL2}&type=ethereum-enabled`);
    } else {
      navigate(`/manage/${token.address}`);
    }
  };

  return (
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-3 sm:p-6 animate-fade-in gap-4 sm:gap-6">
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-4 sm:gap-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
              All Tokens
            </h2>
            {!isLoading && (
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filtered.length}{search ? ` of ${tokens.length}` : ''} token{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, symbol, address…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 w-48 sm:w-60"
              />
            </div>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="text-gray-500 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <ExploreTokenTable
          tokens={sorted}
          onView={handleView}
          isLoading={isLoading}
          tokenLogos={tokenLogos}
          sortColumn={sortColumn}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
