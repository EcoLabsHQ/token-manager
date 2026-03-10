import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Check, Loader2, RefreshCw, Search } from 'lucide-react';
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

const EXPLORER_URLS = { ethereum: 'https://etherscan.io/address/', celo: 'https://celoscan.io/address/' };

const AddressWithActions = ({ address, chain }: { address: string; chain: 'ethereum' | 'celo' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-sm text-black font-mono" title={address}>{truncateAddress(address)}</span>
      <button onClick={handleCopy} className="p-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />}
      </button>
      <a href={`${EXPLORER_URLS[chain]}${address}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors">
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
      </a>
    </div>
  );
};

// ─── Token Table ─────────────────────────────────────────────────────────────

const ExploreTokenTable = ({
  tokens,
  onView,
  isLoading,
  tokenLogos,
}: {
  tokens: TokenPair[];
  onView: (token: TokenPair) => void;
  isLoading?: boolean;
  tokenLogos: Record<string, string>;
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
      {/* Desktop Header */}
      <div className="bg-gray-50/80 border-b border-gray-200 hidden lg:flex items-center px-4 py-3">
        <div className="w-[180px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Name</div>
        <div className="w-[80px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Ticker</div>
        <div className="w-[120px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide">Type</div>
        <div className="w-[100px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Total Supply</div>
        <div className="w-[100px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Max Supply</div>
        <div className="w-[70px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Holders</div>
        <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide pl-4">Address (L1)</div>
        <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide">Address (L2)</div>
        <div className="w-[70px] shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
      </div>
      {/* Mobile Header */}
      <div className="bg-gray-50/80 border-b border-gray-200 flex items-center px-3 py-2.5 lg:hidden">
        <div className="flex-1 text-gray-500 text-xs font-medium uppercase tracking-wide">Name</div>
        <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide">Ticker</div>
        <div className="w-24 text-gray-500 text-xs font-medium uppercase tracking-wide">Type</div>
        <div className="w-16 text-gray-500 text-xs font-medium uppercase tracking-wide text-right">Action</div>
      </div>

      {/* Rows */}
      {tokens.map(token => {
        const logoUrl = getLogoUrl(token);
        return (
          <div key={token.id}>
            {/* Mobile row */}
            <div className="bg-white flex items-center min-h-[48px] px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 lg:hidden">
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

            {/* Desktop row */}
            <div className="bg-white hidden lg:flex items-center min-h-[52px] px-4 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
              <div className="w-[180px] shrink-0 flex items-center gap-2">
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
              <div className="w-[100px] shrink-0 text-right">
                <span className="text-sm text-black tabular-nums">{token.totalSupplyFormatted}</span>
              </div>
              <div className="w-[100px] shrink-0 text-right">
                <span className="text-sm text-black tabular-nums">{token.maxSupplyFormatted}</span>
              </div>
              <div className="w-[70px] shrink-0 text-right">
                <span className="text-sm text-black tabular-nums">{token.totalUniqueHolders.toLocaleString()}</span>
              </div>
              <div className="flex-1 pl-4 min-w-0">
                {token.addressL1 ? <AddressWithActions address={token.addressL1} chain="ethereum" /> : <span className="text-sm text-gray-400">—</span>}
              </div>
              <div className="flex-1 min-w-0">
                {token.addressL2 ? <AddressWithActions address={token.addressL2} chain="celo" /> : <span className="text-sm text-gray-400">—</span>}
              </div>
              <div className="w-[70px] shrink-0 text-right">
                <button onClick={() => onView(token)} className="bg-black text-white text-xs font-medium h-7 px-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors">
                  View
                </button>
              </div>
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
  );
};

// ─── Explore Page ─────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();
  const { tokens, isLoading, refetch } = useAllSubgraphTokens();
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

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
          tokens={filtered}
          onView={handleView}
          isLoading={isLoading}
          tokenLogos={tokenLogos}
        />
      </div>
    </div>
  );
}
