import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { useTokenManager } from '../hooks';
import { formatNumberWithCommas, parseFormattedNumber, formatDisplayNumber } from '../lib/utils';

// Chain icons using PNG images
const EthereumIcon = () => (
  <div className="w-7 h-7 rounded-lg overflow-hidden border-[1.5px] border-white shadow-sm">
    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
  </div>
);

const CeloIcon = () => (
  <div className="w-7 h-7 rounded-lg overflow-hidden border-[1.5px] border-white shadow-sm">
    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
  </div>
);

// Menu Items
type MenuSection = 'transfer' | 'mint' | 'burn' | 'pause' | 'admin';

interface NavigationMenuProps {
  activeSection: MenuSection;
  onSectionChange: (section: MenuSection) => void;
}

const NavigationMenu = ({ activeSection, onSectionChange }: NavigationMenuProps) => {
  const menuItems: { id: MenuSection; label: string }[] = [
    { id: 'transfer', label: 'Transfer' },
    { id: 'mint', label: 'Mint' },
    { id: 'burn', label: 'Burn' },
    { id: 'pause', label: 'Pause' },
  ];

  return (
    <>
      {/* Mobile horizontal menu */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 flex gap-1 overflow-x-auto md:hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`h-8 px-3 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0
              ${activeSection === item.id
                ? 'bg-gray-100 text-black'
                : 'text-black hover:bg-gray-50'
              }`}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => onSectionChange('admin')}
          className={`h-8 px-3 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0
            ${activeSection === 'admin'
              ? 'bg-gray-100 text-black'
              : 'text-black hover:bg-gray-50'
            }`}
        >
          Admin
        </button>
      </div>
      
      {/* Desktop vertical menu */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 w-56 hidden md:flex flex-col gap-5 flex-shrink-0">
        <h3 className="text-base font-semibold text-black tracking-tight">Navigate</h3>
        <div className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`h-9 px-3.5 rounded-lg text-sm font-medium text-left transition-all duration-150 cursor-pointer
                ${activeSection === item.id
                  ? 'bg-gray-100 text-black'
                  : 'text-black hover:bg-gray-50'
                }`}
            >
              {item.label}
            </button>
          ))}
          <div className="h-px bg-gray-200 my-2" />
          <button
            onClick={() => onSectionChange('admin')}
            className={`h-9 px-3.5 rounded-lg text-sm font-medium text-left transition-all duration-150 cursor-pointer
              ${activeSection === 'admin'
                ? 'bg-gray-100 text-black'
                : 'text-black hover:bg-gray-50'
              }`}
          >
            Admin / Ownership
          </button>
        </div>
      </div>
    </>
  );
};

// Input Field Component
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
  readOnly?: boolean;
  formatNumber?: boolean;
}

const InputField = ({ label, value, onChange, placeholder, suffix, disabled, readOnly, formatNumber }: InputFieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (formatNumber) {
      const rawValue = parseFormattedNumber(e.target.value);
      // Only allow numeric input
      if (rawValue && !/^\d*\.?\d*$/.test(rawValue)) return;
      onChange(rawValue);
    } else {
      onChange(e.target.value);
    }
  };

  const displayValue = formatNumber ? formatNumberWithCommas(value) : value;

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <label className="text-xs sm:text-sm text-gray-500 leading-relaxed">{label}</label>
      <div className={`border border-gray-300 rounded-md flex items-center px-2 sm:px-2.5 py-1.5 sm:py-2 ${disabled ? 'bg-gray-50' : 'bg-white'}`}>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className="flex-1 text-xs sm:text-sm text-black outline-none bg-transparent placeholder:text-gray-400 min-w-0"
        />
        {suffix && <span className="text-xs sm:text-sm text-black ml-2 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
};

// Read-only Field Component
interface ReadOnlyFieldProps {
  label: string;
  value: string;
  onCopy?: () => void;
}

const ReadOnlyField = ({ label, value, onCopy }: ReadOnlyFieldProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label className="text-xs sm:text-sm text-gray-500 leading-relaxed">{label}</label>
      <div className="border border-gray-300 rounded-md flex items-center px-2 sm:px-2.5 py-1.5 sm:py-2 bg-white">
        <span className="flex-1 text-xs sm:text-sm text-black font-mono truncate">{value}</span>
        {onCopy && (
          <button
            onClick={handleCopy}
            className="p-1 rounded transition-colors hover:bg-gray-100 cursor-pointer flex-shrink-0"
          >
            {copied ? (
              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Action Button
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
  loading?: boolean;
}

const ActionButton = ({ label, onClick, disabled, variant = 'primary', loading }: ActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer flex items-center justify-center gap-2
      ${disabled || loading
        ? 'bg-black/15 text-white cursor-not-allowed'
        : variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
          : 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
      }
      focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2`}
  >
    {loading && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />}
    {label}
  </button>
);

// Section Card Component
interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

const SectionCard = ({ title, children }: SectionCardProps) => (
  <div className="border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-4">
    <h4 className="text-xs sm:text-sm font-semibold text-black tracking-tight">{title}</h4>
    {children}
  </div>
);

// Transfer Section
interface TransferSectionProps {
  symbol: string;
  onTransfer: (to: string, amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const TransferSection = ({ symbol, onTransfer, isLoading }: TransferSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && parseFloat(amount) > 0;

  const handleTransfer = async () => {
    setError(null);
    setSuccess(false);
    const result = await onTransfer(toAddress, amount);
    if (result.success) {
      setSuccess(true);
      setToAddress('');
      setAmount('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Transfer failed');
    }
  };

  return (
    <SectionCard title="Transfer">
      <div className="flex flex-col sm:flex-row gap-3">
        <InputField
          label="To"
          value={toAddress}
          onChange={setToAddress}
          placeholder="0x..."
        />
        <InputField
          label="Amount"
          value={amount}
          onChange={setAmount}
          placeholder="1,000,000"
          suffix={symbol}
          formatNumber
        />
      </div>
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Transfer successful!</p>}
      <ActionButton label="Transfer" onClick={handleTransfer} disabled={!isValid} loading={isLoading} />
    </SectionCard>
  );
};

// Mint Section
interface MintSectionProps {
  symbol: string;
  onMint: (to: string, amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
}

const MintSection = ({ symbol, onMint, isLoading, isOwner }: MintSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && parseFloat(amount) > 0;

  const handleMint = async () => {
    setError(null);
    setSuccess(false);
    const result = await onMint(toAddress, amount);
    if (result.success) {
      setSuccess(true);
      setToAddress('');
      setAmount('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Mint failed');
    }
  };

  return (
    <SectionCard title="Mint">
      {!isOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the token owner can mint new tokens.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <InputField
          label="To"
          value={toAddress}
          onChange={setToAddress}
          placeholder="0x..."
          disabled={!isOwner}
        />
        <InputField
          label="Amount"
          value={amount}
          onChange={setAmount}
          placeholder="1,000,000"
          suffix={symbol}
          disabled={!isOwner}
          formatNumber
        />
      </div>
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Mint successful!</p>}
      <ActionButton label="Mint" onClick={handleMint} disabled={!isValid || !isOwner} loading={isLoading} />
    </SectionCard>
  );
};

// Burn Section
interface BurnSectionProps {
  symbol: string;
  onBurn: (amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  userBalance: string;
}

const BurnSection = ({ symbol, onBurn, isLoading, userBalance }: BurnSectionProps) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const isValid = parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(userBalance);

  const handleBurn = async () => {
    setError(null);
    setSuccess(false);
    const result = await onBurn(amount);
    if (result.success) {
      setSuccess(true);
      setAmount('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Burn failed');
    }
  };

  return (
    <SectionCard title="Burn">
      <p className="text-xs sm:text-sm text-gray-600">
        Your balance: {formatDisplayNumber(userBalance)} {symbol}
      </p>
      <InputField
        label="Amount"
        value={amount}
        onChange={setAmount}
        placeholder="1,000,000"
        suffix={symbol}
        formatNumber
      />
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Burn successful!</p>}
      <ActionButton label="Burn" onClick={handleBurn} disabled={!isValid} variant="danger" loading={isLoading} />
    </SectionCard>
  );
};

// Pause Section
interface PauseSectionProps {
  isPaused: boolean;
  onPause: () => Promise<{ success: boolean; error?: string }>;
  onUnpause: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
}

const PauseSection = ({ isPaused, onPause, onUnpause, isLoading, isOwner }: PauseSectionProps) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleToggle = async () => {
    setError(null);
    setSuccess(false);
    const result = isPaused ? await onUnpause() : await onPause();
    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Operation failed');
    }
  };

  return (
    <SectionCard title="Pause Contract">
      {!isOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the token owner can pause/unpause the contract.
        </p>
      )}
      <p className="text-xs sm:text-sm text-gray-600">
        {isPaused
          ? 'The contract is currently paused. All transfers are disabled.'
          : 'Pause the contract to disable all token transfers.'}
      </p>
      <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium ${isPaused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        Status: {isPaused ? 'Paused' : 'Active'}
      </div>
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Operation successful!</p>}
      <ActionButton
        label={isPaused ? 'Unpause' : 'Pause'}
        onClick={handleToggle}
        variant={isPaused ? 'primary' : 'danger'}
        disabled={!isOwner}
        loading={isLoading}
      />
    </SectionCard>
  );
};

// Transfer Ownership Section
interface TransferOwnershipSectionProps {
  onTransferOwnership: (newOwner: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
  currentOwner: string;
}

const TransferOwnershipSection = ({ onTransferOwnership, isLoading, isOwner, currentOwner }: TransferOwnershipSectionProps) => {
  const [newOwner, setNewOwner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const isValid = newOwner.startsWith('0x') && newOwner.length === 42 && newOwner.toLowerCase() !== currentOwner.toLowerCase();

  const handleTransfer = async () => {
    setError(null);
    setSuccess(false);
    const result = await onTransferOwnership(newOwner);
    if (result.success) {
      setSuccess(true);
      setNewOwner('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Transfer ownership failed');
    }
  };

  return (
    <SectionCard title="Transfer ownership">
      {!isOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the current owner can transfer ownership.
        </p>
      )}
      <div className="text-xs sm:text-sm text-gray-600">
        <span className="font-medium">Current owner:</span>{' '}
        <span className="font-mono text-[10px] sm:text-xs break-all">{currentOwner}</span>
      </div>
      <InputField
        label="New Owner Address"
        value={newOwner}
        onChange={setNewOwner}
        placeholder="0x..."
        disabled={!isOwner}
      />
      <p className="text-[10px] sm:text-xs text-gray-500">
        Note: The new owner will need to call acceptOwnership() to complete the transfer.
      </p>
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Ownership transfer initiated!</p>}
      <ActionButton label="Transfer Ownership" onClick={handleTransfer} disabled={!isValid || !isOwner} loading={isLoading} />
    </SectionCard>
  );
};

// Token Info Header
interface TokenInfoHeaderProps {
  tokenAddress: string;
  name: string;
  symbol: string;
  isL2Token: boolean;
  totalSupply: string;
  userBalance: string;
  decimals: number;
  // For Ethereum Enabled tokens - show both L1 and L2
  isEthereumEnabled?: boolean;
  l1TokenAddress?: string;
  l2TokenAddress?: string;
  l1TokenManager?: ReturnType<typeof useTokenManager>;
  l2TokenManager?: ReturnType<typeof useTokenManager>;
}

const TokenInfoHeader = ({ 
  tokenAddress, 
  name, 
  symbol, 
  isL2Token, 
  totalSupply, 
  userBalance, 
  decimals,
  isEthereumEnabled,
  l1TokenAddress,
  l2TokenAddress,
  l1TokenManager,
  l2TokenManager
}: TokenInfoHeaderProps) => {
  // If Ethereum Enabled, show both tokens
  if (isEthereumEnabled && l1TokenAddress && l2TokenAddress && l1TokenManager && l2TokenManager) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
            {name} ({symbol})
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600">Ethereum Enabled</span>
            <div className="flex items-center">
              <EthereumIcon />
              <div className="-ml-2">
                <CeloIcon />
              </div>
            </div>
          </div>
        </div>

        {/* L1 Token Info */}
        <div className="border border-gray-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
              <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-semibold text-black">Ethereum L1 Token</span>
          </div>
          <div className="flex flex-col gap-2">
            <ReadOnlyField
              label="Token address"
              value={l1TokenAddress}
              onCopy={() => {}}
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
              <ReadOnlyField label="Total Supply" value={formatDisplayNumber(l1TokenManager.totalSupply)} />
              <ReadOnlyField label="My Balance" value={formatDisplayNumber(l1TokenManager.userBalance)} />
            </div>
          </div>
        </div>

        {/* L2 Token Info */}
        <div className="border border-gray-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
              <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-semibold text-black">Celo L2 Token</span>
          </div>
          <div className="flex flex-col gap-2">
            <ReadOnlyField
              label="Token address"
              value={l2TokenAddress}
              onCopy={() => {}}
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
              <ReadOnlyField label="Total Supply" value={formatDisplayNumber(l2TokenManager.totalSupply)} />
              <ReadOnlyField label="My Balance" value={formatDisplayNumber(l2TokenManager.userBalance)} />
            </div>
          </div>
        </div>

        {/* Common Stats */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          <ReadOnlyField label="Decimals" value={decimals.toString()} />
        </div>
      </div>
    );
  }

  // Single token display (Celo-Native or fallback)
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
          {name} ({symbol})
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-600">
            {isL2Token ? 'Celo L2' : 'Ethereum L1'}
          </span>
          <div className="flex items-center">
            {isL2Token ? (
              <CeloIcon />
            ) : (
              <EthereumIcon />
            )}
          </div>
        </div>
      </div>

      {/* Token Address */}
      <ReadOnlyField
        label="Token address"
        value={tokenAddress}
        onCopy={() => {}}
      />

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
        <ReadOnlyField label="Decimals" value={decimals.toString()} />
        <ReadOnlyField label="Total Supply" value={formatDisplayNumber(totalSupply)} />
        <ReadOnlyField label="My Balance" value={formatDisplayNumber(userBalance)} />
      </div>
    </div>
  );
};

// Main Content Area
interface ContentAreaProps {
  activeSection: MenuSection;
  tokenManager: ReturnType<typeof useTokenManager>;
}

const ContentArea = ({ activeSection, tokenManager }: ContentAreaProps) => {
  const {
    symbol,
    isPaused,
    isOwner,
    isLoading,
    userBalance,
    owner,
    transfer,
    mint,
    burn,
    pause,
    unpause,
    transferOwnership,
  } = tokenManager;

  const renderContent = () => {
    switch (activeSection) {
      case 'transfer':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <TransferSection 
              symbol={symbol || ''} 
              onTransfer={transfer}
              isLoading={isLoading}
            />
          </div>
        );
      case 'mint':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <MintSection 
              symbol={symbol || ''} 
              onMint={mint}
              isLoading={isLoading}
              isOwner={isOwner}
            />
          </div>
        );
      case 'burn':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <BurnSection 
              symbol={symbol || ''} 
              onBurn={burn}
              isLoading={isLoading}
              userBalance={userBalance}
            />
          </div>
        );
      case 'pause':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Contract Status</h3>
            <PauseSection 
              isPaused={isPaused} 
              onPause={pause}
              onUnpause={unpause}
              isLoading={isLoading}
              isOwner={isOwner}
            />
          </div>
        );
      case 'admin':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Ownership</h3>
            <TransferOwnershipSection 
              onTransferOwnership={transferOwnership}
              isLoading={isLoading}
              isOwner={isOwner}
              currentOwner={owner || ''}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex-1 flex flex-col">
      {renderContent()}
    </div>
  );
};

// Main TokenManager Component
export default function TokenManager() {
  const { tokenAddress } = useParams<{ tokenAddress: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<MenuSection>('transfer');
  const [isL2Token, setIsL2Token] = useState<boolean | null>(null);

  // Check if this is an Ethereum Enabled token with both L1 and L2
  const l2TokenFromParams = searchParams.get('l2Token');
  const tokenType = searchParams.get('type');
  const isEthereumEnabled = tokenType === 'ethereum-enabled' && !!l2TokenFromParams;

  // Initialize token managers for L1 (the tokenAddress param)
  const tokenManagerL1 = useTokenManager({
    tokenAddress: tokenAddress,
    isL2Token: false,
  });

  // Initialize token manager for L2 (from query params if ethereum-enabled, otherwise try the main address)
  const tokenManagerL2 = useTokenManager({
    tokenAddress: isEthereumEnabled ? l2TokenFromParams : tokenAddress,
    isL2Token: true,
  });

  // Determine which chain has the token based on whether we get a name back
  useEffect(() => {
    if (isEthereumEnabled) {
      // For ethereum-enabled, we always use L1 as primary for actions
      setIsL2Token(false);
    } else if (tokenManagerL2.name) {
      setIsL2Token(true);
    } else if (tokenManagerL1.name) {
      setIsL2Token(false);
    }
  }, [tokenManagerL2.name, tokenManagerL1.name, isEthereumEnabled]);

  // Use the appropriate token manager for actions
  const tokenManager = isL2Token === false ? tokenManagerL1 : tokenManagerL2;

  // Loading state while determining which chain
  const isLoadingToken = isL2Token === null && !tokenManagerL2.name && !tokenManagerL1.name;

  if (isLoadingToken) {
    return (
      <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-6 items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-black mb-2">Loading Token...</h2>
          <p className="text-sm text-gray-500">
            Fetching token information from the blockchain.
          </p>
        </div>
      </div>
    );
  }

  if (!tokenManager.name) {
    return (
      <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-6 items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-400">
              <path
                d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-black mb-2">Token Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">
            The token you're looking for doesn't exist or couldn't be loaded.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-black text-white text-sm font-medium h-9 px-4 rounded-lg 
                       flex items-center gap-2 mx-auto cursor-pointer
                       transition-all duration-150 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-3 sm:p-6 animate-fade-in items-center">
      <div className="w-full max-w-[960px]">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 hover:text-black transition-colors mb-3 sm:mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          Back to Dashboard
        </button>

        {/* Token Info Header */}
        <TokenInfoHeader 
          tokenAddress={tokenAddress || ''} 
          name={tokenManager.name || ''}
          symbol={tokenManager.symbol || ''}
          isL2Token={isL2Token ?? true}
          totalSupply={tokenManager.totalSupply}
          userBalance={tokenManager.userBalance}
          decimals={tokenManager.decimals}
          isEthereumEnabled={isEthereumEnabled}
          l1TokenAddress={isEthereumEnabled ? tokenAddress : undefined}
          l2TokenAddress={isEthereumEnabled ? l2TokenFromParams || undefined : undefined}
          l1TokenManager={isEthereumEnabled ? tokenManagerL1 : undefined}
          l2TokenManager={isEthereumEnabled ? tokenManagerL2 : undefined}
        />

        {/* Main Content */}
        <div className="flex flex-col md:flex-row gap-3 mt-3">
          <NavigationMenu activeSection={activeSection} onSectionChange={setActiveSection} />
          <ContentArea activeSection={activeSection} tokenManager={tokenManager} />
        </div>
      </div>
    </div>
  );
}
