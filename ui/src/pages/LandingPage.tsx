import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { useAllSubgraphTokens } from '../hooks/useAllSubgraphTokens';
import { findLogoBatch } from '../hooks/useTokenLogo';
import { CONTRACTS } from '@/config/contracts';
import type { TokenPair } from '../hooks/useSubgraphTokens';

// ─── Shared helpers ────────────────────────────────────────────────────────────

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

const TokenLogo = ({ logoUrl, name, symbol, size = 'md' }: { logoUrl?: string; name: string; symbol: string; size?: 'sm' | 'md' }) => {
  const [hasError, setHasError] = useState(false);
  const first = (name || symbol || '?').charAt(0).toUpperCase();
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  if (!logoUrl || hasError) {
    return (
      <div className={`${dim} rounded-full flex items-center justify-center shrink-0`} style={{ backgroundColor: stringToColor(name || symbol) }}>
        <span className="text-sm font-bold" style={{ color: stringToColorDark(name || symbol) }}>{first}</span>
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-full overflow-hidden shrink-0 border border-gray-100`}>
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

// ─── Stats card ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col gap-1">
    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
    <span className="text-2xl font-bold text-black tabular-nums">{value}</span>
  </div>
);

// ─── Top-10 token row ─────────────────────────────────────────────────────────

const TopTokenRow = ({
  rank,
  token,
  logoUrl,
  onClick,
}: {
  rank: number;
  token: TokenPair;
  logoUrl?: string;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
  >
    {/* Rank */}
    <span className="w-6 text-xs font-medium text-gray-400 tabular-nums shrink-0 text-center">{rank}</span>

    {/* Logo + name */}
    <TokenLogo logoUrl={logoUrl} name={token.name} symbol={token.symbol} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-black truncate">{token.name}</p>
      <p className="text-xs text-gray-400 font-mono">{token.symbol}</p>
    </div>

    {/* Chain badge */}
    <div className="hidden sm:flex items-center gap-1 shrink-0">
      {token.type === 'ethereum-enabled' ? (
        <>
          <EthereumIcon />
          <div className="-ml-1.5"><CeloIcon /></div>
        </>
      ) : (
        <CeloIcon />
      )}
      <span className="text-xs text-gray-500 ml-1 hidden md:inline">
        {token.type === 'ethereum-enabled' ? 'ETH + Celo' : 'Celo'}
      </span>
    </div>

    {/* Transfers */}
    <div className="w-20 text-right shrink-0 hidden sm:block">
      <p className="text-xs text-gray-400">Transfers</p>
      <p className="text-sm font-medium text-black tabular-nums">{token.totalTransfers.toLocaleString()}</p>
    </div>

    {/* Supply */}
    <div className="w-28 text-right shrink-0 hidden sm:block">
      <p className="text-xs text-gray-400">Supply</p>
      <p className="text-sm font-medium text-black tabular-nums">{token.totalSupplyFormatted}</p>
    </div>

    {/* Holders */}
    <div className="w-16 text-right shrink-0 hidden md:block">
      <p className="text-xs text-gray-400">Holders</p>
      <p className="text-sm font-medium text-black tabular-nums">{token.totalUniqueHolders.toLocaleString()}</p>
    </div>

    {/* Address */}
    <div className="w-28 shrink-0 hidden lg:flex items-center gap-1">
      <span className="text-xs text-gray-500 font-mono">
        {truncateAddress(token.addressL2 || token.address)}
      </span>
      <a
        href={`https://celoscan.io/address/${token.addressL2 || token.address}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>

    {/* Arrow */}
    <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
  </div>
);

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate();
  const { tokens, isLoading, refetch } = useAllSubgraphTokens();
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});

  const top10 = tokens.slice(0, 10);

  // Stats
  const totalEthEnabled = tokens.filter(t => t.type === 'ethereum-enabled').length;
  const totalCeloNative = tokens.filter(t => t.type === 'celo-native').length;
  const totalHolders = tokens.reduce((acc, t) => acc + t.totalUniqueHolders, 0);

  // Fetch logos
  useEffect(() => {
    if (top10.length === 0) return;
    const tokensToFetch = top10.map(token => ({
      chainId: token.addressL2
        ? CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId
        : CONTRACTS.L1_TOKEN_FACTORY.chainId,
      address: token.addressL2 || token.address,
    }));
    findLogoBatch(tokensToFetch).then(setTokenLogos);
  }, [tokens]);

  const getLogoUrl = (token: TokenPair) => {
    const address = (token.addressL2 || token.address).toLowerCase();
    return tokenLogos[address];
  };

  const handleTokenClick = (token: TokenPair) => {
    if (token.type === 'ethereum-enabled' && token.addressL1 && token.addressL2) {
      navigate(`/manage/${token.addressL1}?l2Token=${token.addressL2}&type=ethereum-enabled`);
    } else {
      navigate(`/manage/${token.address}`);
    }
  };

  return (
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-3 sm:p-6 animate-fade-in gap-4 sm:gap-6">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Tokens" value={isLoading ? '—' : tokens.length} />
        <StatCard label="ETH + Celo" value={isLoading ? '—' : totalEthEnabled} />
        <StatCard label="Celo-Native" value={isLoading ? '—' : totalCeloNative} />
        <StatCard label="Total Holders" value={isLoading ? '—' : totalHolders.toLocaleString()} />
      </div>

      {/* ── Top Tokens ── */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
              Top Tokens
            </h2>
            {!isLoading && tokens.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                by transfers
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isLoading}
              className="text-gray-400 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              to="/explore"
              className="flex items-center gap-1.5 bg-black text-white text-xs sm:text-sm font-medium h-8 sm:h-9 px-3 sm:px-4 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse all tokens
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table header (desktop) */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg text-xs font-medium text-gray-400 uppercase tracking-wide">
          <span className="w-6 text-center">#</span>
          <span className="w-9" />
          <span className="flex-1">Name</span>
          <span className="hidden md:block w-24 text-center">Chain</span>
          <span className="w-20 text-right">Transfers</span>
          <span className="w-28 text-right">Supply</span>
          <span className="hidden md:block w-16 text-right">Holders</span>
          <span className="hidden lg:block w-28">Address (L2)</span>
          <span className="w-4" />
        </div>

        {/* Token list */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Loading tokens…</span>
            </div>
          ) : top10.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <span className="text-sm text-gray-500">No tokens found</span>
            </div>
          ) : (
            top10.map((token, i) => (
              <TopTokenRow
                key={token.id}
                rank={i + 1}
                token={token}
                logoUrl={getLogoUrl(token)}
                onClick={() => handleTokenClick(token)}
              />
            ))
          )}
        </div>

        {/* Browse all CTA */}
        {!isLoading && tokens.length > 10 && (
          <div className="flex justify-center pt-1">
            <Link
              to="/explore"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors font-medium"
            >
              View all {tokens.length} tokens
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
