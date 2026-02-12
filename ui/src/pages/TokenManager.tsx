import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, ArrowLeft, Loader2, ArrowRightLeft, Clock, AlertTriangle, Camera } from 'lucide-react';
import { useTokenManager, useWithdraw, usePendingWithdrawals, useTokenLogo, findLogoUrl, type PendingWithdrawalStorage, type WithdrawalStatus } from '../hooks';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain, useConfig } from 'wagmi';
import { parseUnits, getAddress } from 'viem';
import { celoSepolia } from 'viem/chains';
import { CONTRACTS } from '@/config/contracts';
import { formatNumberWithCommas, parseFormattedNumber, formatDisplayNumber } from '../lib/utils';
import { MultistepProgressModal, type MultistepProgressStep } from '../components';
import { WithdrawalProgressModal } from '../components/WithdrawalProgressModal';

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

// Token Logo component with fallback to first letter and optional upload capability
interface TokenLogoProps {
  logoUrl?: string;
  name: string;
  symbol: string;
  onLogoChange?: (file: File) => void;
  isUploading?: boolean;
  canEdit?: boolean;
}

const TokenLogo = ({ logoUrl, name, symbol, onLogoChange, isUploading, canEdit }: TokenLogoProps) => {
  const [hasError, setHasError] = useState(false);
  const firstLetter = (name || symbol || '?').charAt(0).toUpperCase();
  const bgColor = stringToColor(name || symbol || '');
  const textColor = stringToColorDark(name || symbol || '');
  
  const handleClick = () => {
    if (!onLogoChange || !canEdit) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 500 * 1024) {
          alert('Image must be less than 500KB');
          return;
        }
        onLogoChange(file);
      }
    };
    input.click();
  };

  const wrapperClasses = `relative ${canEdit ? 'cursor-pointer group' : ''}`;
  const overlayClasses = canEdit ? 'absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity' : 'hidden';
  
  if (!logoUrl || hasError) {
    return (
      <div className={wrapperClasses} onClick={handleClick}>
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-white/20"
          style={{ backgroundColor: bgColor }}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <span className="text-base font-bold" style={{ color: textColor }}>{firstLetter}</span>
          )}
        </div>
        <div className={overlayClasses}>
          <Camera className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={wrapperClasses} onClick={handleClick}>
      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-gray-100">
        {isUploading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : (
          <img 
            src={logoUrl} 
            alt={`${name} logo`}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        )}
      </div>
      <div className={overlayClasses}>
        <Camera className="w-4 h-4 text-white" />
      </div>
    </div>
  );
};

// Menu Items
type MenuSection = 'transfer' | 'mint' | 'burn' | 'bridge' | 'pause' | 'admin';

interface NavigationMenuProps {
  activeSection: MenuSection;
  onSectionChange: (section: MenuSection) => void;
  showBridge?: boolean;
}

const NavigationMenu = ({ activeSection, onSectionChange, showBridge = false }: NavigationMenuProps) => {
  const menuItems: { id: MenuSection; label: string }[] = [
    { id: 'transfer', label: 'Transfer' },
    { id: 'mint', label: 'Mint' },
    { id: 'burn', label: 'Burn' },
    ...(showBridge ? [{ id: 'bridge' as MenuSection, label: 'Bridge' }] : []),
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

// Paused Warning Component
const PausedWarning = () => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
    <span className="text-red-500 text-lg">⚠️</span>
    <div>
      <p className="text-red-700 font-medium text-sm">Token is Paused</p>
      <p className="text-red-600 text-xs mt-0.5">All token operations are disabled while the contract is paused.</p>
    </div>
  </div>
);

// Transfer Section
interface TransferSectionProps {
  symbol: string;
  onTransfer: (to: string, amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  userBalance: string;
  onSuccess?: () => void;
  isPaused?: boolean;
}

const TransferSection = ({ symbol, onTransfer, isLoading, userBalance, onSuccess, isPaused = false }: TransferSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const amountNum = parseFloat(amount.replace(/,/g, '') || '0');
  const balanceNum = parseFloat(userBalance.replace(/,/g, '') || '0');
  const isValidAddress = toAddress.startsWith('0x') && toAddress.length === 42;
  const isValidAmount = amountNum > 0 && amountNum <= balanceNum;
  const isValid = isValidAddress && isValidAmount;
  const exceedsBalance = amountNum > balanceNum && amountNum > 0;

  const handleTransfer = async () => {
    setError(null);
    setSuccess(false);
    const result = await onTransfer(toAddress, amount);
    if (result.success) {
      setSuccess(true);
      setToAddress('');
      setAmount('');
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Transfer failed');
    }
  };

  return (
    <SectionCard title="Transfer">
      {isPaused && <PausedWarning />}
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
      {exceedsBalance && !error && <p className="text-red-500 text-xs sm:text-sm">Amount exceeds your balance ({formatDisplayNumber(userBalance)} {symbol})</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Transfer successful!</p>}
      <ActionButton label="Transfer" onClick={handleTransfer} disabled={!isValid || isPaused} loading={isLoading} />
    </SectionCard>
  );
};

// Mint Section
interface MintSectionProps {
  symbol: string;
  onMint: (to: string, amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
  onSuccess?: () => void;
  isPaused?: boolean;
  connectedAddress?: string;
  totalSupply?: string;
  maxSupply?: string;
}

const MintSection = ({ symbol, onMint, isLoading, isOwner, onSuccess, isPaused = false, connectedAddress, totalSupply = '0', maxSupply = '0' }: MintSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Calculate available to mint
  const totalNum = parseFloat(totalSupply) || 0;
  const maxNum = parseFloat(maxSupply) || 0;
  const hasMaxSupply = maxNum > 0;
  const availableToMint = hasMaxSupply ? maxNum - totalNum : Infinity;
  
  // Check if amount exceeds available
  const amountNum = parseFloat(amount.replace(/,/g, '')) || 0;
  const exceedsMaxSupply = hasMaxSupply && amountNum > availableToMint;
  
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && amountNum > 0 && !exceedsMaxSupply;

  const handleMint = async () => {
    setError(null);
    setSuccess(false);
    const result = await onMint(toAddress, amount);
    if (result.success) {
      setSuccess(true);
      setToAddress('');
      setAmount('');
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Mint failed');
    }
  };

  return (
    <SectionCard title="Mint">
      {isPaused && <PausedWarning />}
      {!isOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the token owner can mint new tokens.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs sm:text-sm text-gray-500">To</label>
            {connectedAddress && isOwner && (
              <button
                type="button"
                onClick={() => setToAddress(connectedAddress)}
                className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Admin
              </button>
            )}
          </div>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            disabled={!isOwner}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
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
      {exceedsMaxSupply && (
        <p className="text-red-500 text-xs sm:text-sm bg-red-50 p-2 rounded-lg">
          ⚠️ No additional tokens can be minted beyond the Max Total Supply of your token.
        </p>
      )}
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Mint successful!</p>}
      <ActionButton label="Mint" onClick={handleMint} disabled={!isValid || !isOwner || isPaused} loading={isLoading} />
    </SectionCard>
  );
};

// Burn Section
interface BurnSectionProps {
  symbol: string;
  onBurn: (amount: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  userBalance: string;
  onSuccess?: () => void;
  isPaused?: boolean;
}

const BurnSection = ({ symbol, onBurn, isLoading, userBalance, onSuccess, isPaused = false }: BurnSectionProps) => {
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
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Burn failed');
    }
  };

  return (
    <SectionCard title="Burn">
      {isPaused && <PausedWarning />}
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
      <ActionButton label="Burn" onClick={handleBurn} disabled={!isValid || isPaused} variant="danger" loading={isLoading} />
    </SectionCard>
  );
};

// Pause Section
interface PauseSectionProps {
  isPaused: boolean;
  onPause: (onStepChange?: (step: number) => void) => Promise<{ success: boolean; error?: string }>;
  onUnpause: (onStepChange?: (step: number) => void) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
  onSuccess?: () => void;
  // For Ethereum Enabled tokens
  isEthereumEnabled?: boolean;
  l2IsPaused?: boolean;
}

const PauseSection = ({ isPaused, onPause, onUnpause, isLoading, isOwner, onSuccess, isEthereumEnabled, l2IsPaused }: PauseSectionProps) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Modal state for dual chain operations
  const [showModal, setShowModal] = useState(false);
  const [modalCurrentStep, setModalCurrentStep] = useState(0);
  const [modalTitle, setModalTitle] = useState('');

  const modalSteps = [
    { title: 'Ethereum (L1)', description: isPaused ? 'Unpausing contract on L1' : 'Pausing contract on L1', chain: 'ethereum' as const },
    { title: 'Celo (L2)', description: isPaused ? 'Unpausing contract on L2' : 'Pausing contract on L2', chain: 'celo' as const },
  ];

  const handleToggle = async () => {
    setError(null);
    setSuccess(false);
    
    if (isEthereumEnabled) {
      // Show modal for dual chain operation
      const action = isPaused ? 'Unpause' : 'Pause';
      setModalTitle(`${action} Contract`);
      setModalCurrentStep(1);
      setShowModal(true);
    }
    
    const result = isPaused 
      ? await onUnpause(isEthereumEnabled ? setModalCurrentStep : undefined) 
      : await onPause(isEthereumEnabled ? setModalCurrentStep : undefined);
    
    if (result.success) {
      if (isEthereumEnabled) {
        setModalCurrentStep(3); // All steps complete
        setTimeout(() => setShowModal(false), 1500);
      }
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      if (isEthereumEnabled) {
        setShowModal(false);
      }
      setError(result.error || 'Operation failed');
    }
  };

  // Determine overall paused status for dual chain
  const bothPaused = isEthereumEnabled ? (isPaused && l2IsPaused) : isPaused;
  const bothActive = isEthereumEnabled ? (!isPaused && !l2IsPaused) : !isPaused;
  const mixedState = isEthereumEnabled && isPaused !== l2IsPaused;

  return (
    <SectionCard title="Pause Contract">
      {!isOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the token owner can pause/unpause the contract.
        </p>
      )}
      
      {isEthereumEnabled && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
          ℹ️ This is an Ethereum Enabled token. Pause/Unpause will be applied to both L1 and L2 tokens.
        </p>
      )}
      
      <p className="text-xs sm:text-sm text-gray-600">
        {bothPaused
          ? 'The contract is currently paused. All transfers are disabled.'
          : bothActive
            ? 'Pause the contract to disable all token transfers.'
            : 'The contracts have mixed pause states.'}
      </p>
      
      {isEthereumEnabled ? (
        <div className="space-y-2">
          <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex justify-between items-center ${isPaused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <span>L1 (Ethereum):</span>
            <span>{isPaused ? 'Paused' : 'Active'}</span>
          </div>
          <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex justify-between items-center ${l2IsPaused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <span>L2 (Celo):</span>
            <span>{l2IsPaused ? 'Paused' : 'Active'}</span>
          </div>
        </div>
      ) : (
        <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium ${isPaused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          Status: {isPaused ? 'Paused' : 'Active'}
        </div>
      )}
      
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">Operation successful!</p>}
      
      <ActionButton
        label={bothPaused ? 'Unpause' : mixedState ? 'Sync & Pause' : 'Pause'}
        onClick={handleToggle}
        variant={bothPaused ? 'primary' : 'danger'}
        disabled={!isOwner}
        loading={isLoading}
      />
      
      {/* Progress Modal for Dual Chain */}
      <MultistepProgressModal
        isOpen={showModal}
        title={modalTitle}
        steps={modalSteps}
        currentStep={modalCurrentStep}
      />
    </SectionCard>
  );
};

// Bridge Section
interface BridgeSectionProps {
  symbol: string;
  decimals: number;
  l1TokenAddress: string;
  l2TokenAddress: string;
  l1Balance: string;
  l2Balance: string;
  onSuccess?: () => void;
  isPaused?: boolean;
}

// ERC20 ABI for approve
const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

const BridgeSection = ({ 
  symbol, 
  decimals, 
  l1TokenAddress, 
  l2TokenAddress, 
  l1Balance, 
  l2Balance,
  onSuccess,
  isPaused = false
}: BridgeSectionProps) => {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'l1-to-l2' | 'l2-to-l1'>('l1-to-l2');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bridgeStep, setBridgeStep] = useState<'idle' | 'approving' | 'bridging'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  // L2->L1 withdrawal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<PendingWithdrawalStorage | null>(null);
  const [, setWithdrawalStatus] = useState<WithdrawalStatus>('waiting-to-prove');

  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();
  const l1PublicClient = usePublicClient({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });

  // Withdrawal hooks
  const { 
    initiateWithdrawal, 
    proveWithdrawal, 
    finalizeWithdrawal, 
    getWithdrawalStatus,
    waitForReadyToProve,
    waitForReadyToFinalize,
    isInitiating, 
    isProving, 
    isFinalizing 
  } = useWithdraw();
  
  const { 
    addWithdrawal, 
    updateWithdrawal,
    getWithdrawalsForToken 
  } = usePendingWithdrawals();

  // Get pending withdrawals for this token
  const tokenWithdrawals = getWithdrawalsForToken(l2TokenAddress);

  const sourceBalance = direction === 'l1-to-l2' ? l1Balance : l2Balance;
  const isValid = parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(sourceBalance);

  // Check and update withdrawal statuses periodically
  useEffect(() => {
    const checkStatuses = async () => {
      for (const withdrawal of tokenWithdrawals) {
        if (withdrawal.status === 'finalized') continue;
        
        try {
          const status = await getWithdrawalStatus(withdrawal.l2TxHash);
          if (status && status !== withdrawal.status) {
            updateWithdrawal(withdrawal.l2TxHash, { status });
          }
        } catch (err) {
          console.error('Error checking withdrawal status:', err);
        }
      }
    };

    if (tokenWithdrawals.length > 0) {
      checkStatuses();
      const interval = setInterval(checkStatuses, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [tokenWithdrawals, getWithdrawalStatus, updateWithdrawal]);

  const handleBridge = async () => {
    if (!address || !walletClient || !l1PublicClient) return;
    
    setError(null);
    setSuccess(false);
    setIsLoading(true);
    setTxHash(null);
    setBridgeStep('idle');

    try {
      if (direction === 'l1-to-l2') {
        // Bridge from L1 (Sepolia) to L2 (Celo)
        // First ensure we're on L1
        if (chainId !== CONTRACTS.L1_TOKEN_FACTORY.chainId) {
          await switchChainAsync({ chainId: CONTRACTS.L1_TOKEN_FACTORY.chainId });
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const amountBigInt = parseUnits(amount, decimals);
        const L1_STANDARD_BRIDGE_ADDRESS = celoSepolia.contracts.l1StandardBridge[11155111].address;

        // Step 1: Approve the bridge to spend tokens
        setBridgeStep('approving');
        const approveTx = await walletClient.writeContract({
          address: getAddress(l1TokenAddress),
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [getAddress(L1_STANDARD_BRIDGE_ADDRESS), amountBigInt],
          chain: walletClient.chain,
          account: walletClient.account,
        });

        await l1PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 2: Deposit tokens to bridge
        setBridgeStep('bridging');
        const { depositERC20 } = await import('@eth-optimism/viem/actions');

        const depositTx = await depositERC20(walletClient, {
          tokenAddress: getAddress(l1TokenAddress),
          remoteTokenAddress: getAddress(l2TokenAddress),
          amount: amountBigInt,
          to: address,
          minGasLimit: 2000000,
          l1StandardBridgeAddress: L1_STANDARD_BRIDGE_ADDRESS,
          unsafe: true,
        });

        setTxHash(depositTx);

        const receipt = await l1PublicClient.waitForTransactionReceipt({
          hash: depositTx,
        });

        if (receipt.status === 'reverted') {
          throw new Error('Bridge transaction reverted');
        }

        setSuccess(true);
        setAmount('');
        setBridgeStep('idle');
        onSuccess?.();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        // Bridge from L2 to L1 - Approve + Initiate Withdrawal
        if (chainId !== celoSepolia.id) {
          await switchChainAsync({ chainId: celoSepolia.id });
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const amountBigInt = parseUnits(amount, decimals);
        const L2_STANDARD_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

        // Get L2 public client
        const l2PublicClient = await import('wagmi/actions').then(m => m.getPublicClient(config, { chainId: celoSepolia.id }));
        if (!l2PublicClient) throw new Error('Failed to get L2 public client');

        // Show the withdrawal modal immediately
        setShowWithdrawalModal(true);

        // Step 1: Approve the bridge to spend tokens
        setBridgeStep('approving');
        const approveTx = await walletClient.writeContract({
          address: getAddress(l2TokenAddress),
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [getAddress(L2_STANDARD_BRIDGE_ADDRESS), amountBigInt],
          chain: walletClient.chain,
          account: walletClient.account,
        });

        await l2PublicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 2: Initiate withdrawal
        setBridgeStep('bridging');
        const result = await initiateWithdrawal({
          l2TokenAddress,
          l1TokenAddress,
          amount,
          decimals,
        });

        if (result.success && result.txHash) {
          // Save to pending withdrawals
          const newWithdrawal = addWithdrawal({
            l2TxHash: result.txHash,
            l2TokenAddress,
            l1TokenAddress,
            tokenSymbol: symbol,
            tokenDecimals: decimals,
            amount: amountBigInt.toString(),
            recipient: address,
            status: 'waiting-to-prove',
            initiatedAt: Date.now(),
          });
          
          setBridgeStep('idle');
          setSelectedWithdrawal(newWithdrawal);
          setWithdrawalStatus('waiting-to-prove');
          setAmount('');
          onSuccess?.();
        } else {
          setShowWithdrawalModal(false);
          throw new Error(result.error || 'Failed to initiate withdrawal');
        }
      }
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err instanceof Error ? err.message : 'Bridge failed');
      setBridgeStep('idle');
      // Close modal on error for L2->L1
      if (direction === 'l2-to-l1' && !selectedWithdrawal) {
        setShowWithdrawalModal(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProve = async () => {
    if (!selectedWithdrawal) return;
    
    try {
      // Pass existing proveTxHash to avoid re-proving if already proven
      const result = await proveWithdrawal(
        selectedWithdrawal.l2TxHash,
        selectedWithdrawal.proveTxHash
      );
      if (result.success) {
        // Update with proveTxHash (use existing if alreadyProven, otherwise use new)
        const proveTxHash = result.txHash || selectedWithdrawal.proveTxHash;
        updateWithdrawal(selectedWithdrawal.l2TxHash, { 
          status: 'waiting-to-finalize',
          provenAt: selectedWithdrawal.provenAt || Date.now(),
          proveTxHash
        });
        setWithdrawalStatus('waiting-to-finalize');
        setSelectedWithdrawal(prev => prev ? { 
          ...prev, 
          status: 'waiting-to-finalize', 
          provenAt: prev.provenAt || Date.now(),
          proveTxHash 
        } : null);
        
        if (result.alreadyProven) {
          console.log('Withdrawal was already proven, updated status');
        }
      } else {
        setError(result.error || 'Failed to prove withdrawal');
      }
    } catch (err) {
      console.error('Prove error:', err);
      setError(err instanceof Error ? err.message : 'Failed to prove withdrawal');
    }
  };

  const handleFinalize = async () => {
    if (!selectedWithdrawal) return;
    
    try {
      // Pass existing finalizeTxHash to avoid re-finalizing if already done
      const result = await finalizeWithdrawal(
        selectedWithdrawal.l2TxHash,
        selectedWithdrawal.finalizeTxHash
      );
      if (result.success) {
        const finalizeTxHash = result.txHash || selectedWithdrawal.finalizeTxHash;
        updateWithdrawal(selectedWithdrawal.l2TxHash, { 
          status: 'finalized',
          finalizedAt: selectedWithdrawal.finalizedAt || Date.now(),
          finalizeTxHash
        });
        setWithdrawalStatus('finalized');
        setSelectedWithdrawal(prev => prev ? { 
          ...prev, 
          status: 'finalized', 
          finalizedAt: prev.finalizedAt || Date.now(),
          finalizeTxHash 
        } : null);
        
        if (result.alreadyFinalized) {
          console.log('Withdrawal was already finalized, updated status');
        }
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to finalize withdrawal');
      }
    } catch (err) {
      console.error('Finalize error:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize withdrawal');
    }
  };

  const openWithdrawalModal = async (withdrawal: PendingWithdrawalStorage) => {
    setSelectedWithdrawal(withdrawal);
    
    // Get current status
    try {
      const status = await getWithdrawalStatus(withdrawal.l2TxHash);
      if (status) {
        setWithdrawalStatus(status);
        if (status !== withdrawal.status) {
          updateWithdrawal(withdrawal.l2TxHash, { status });
        }
      }
    } catch (err) {
      console.error('Error getting withdrawal status:', err);
      setWithdrawalStatus(withdrawal.status);
    }
    
    setShowWithdrawalModal(true);
  };

  const getButtonLabel = () => {
    if (bridgeStep === 'approving') return 'Approving...';
    if (bridgeStep === 'bridging') return 'Bridging...';
    if (isInitiating) return 'Initiating Withdrawal...';
    if (isLoading) return 'Processing...';
    return `Bridge to ${direction === 'l1-to-l2' ? 'Celo L2' : 'Ethereum L1'}`;
  };

  // Define bridge steps for the modal
  const bridgeSteps: MultistepProgressStep[] = direction === 'l1-to-l2' ? [
    { title: 'Approve Token Transfer', description: 'Approving bridge to spend your tokens', chain: 'ethereum' },
    { title: 'Bridge Tokens to L2', description: 'Transferring tokens from Ethereum to Celo', chain: 'ethereum' },
  ] : [
    { title: 'Approve Token Transfer', description: 'Approving bridge to spend your tokens', chain: 'celo' },
    { title: 'Initiate Withdrawal', description: 'Burning tokens and starting withdrawal', chain: 'celo' },
  ];

  // Get current step number (1-indexed) for the modal
  const getCurrentStepNumber = () => {
    if (bridgeStep === 'approving') return 1;
    if (bridgeStep === 'bridging') return 2;
    return 0;
  };

  // Get status color
  const getStatusColor = (status: WithdrawalStatus) => {
    switch (status) {
      case 'waiting-to-prove': return 'text-yellow-600 bg-yellow-50';
      case 'ready-to-prove': return 'text-blue-600 bg-blue-50';
      case 'waiting-to-finalize': return 'text-orange-600 bg-orange-50';
      case 'ready-to-finalize': return 'text-green-600 bg-green-50';
      case 'finalized': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get status label
  const getStatusLabel = (status: WithdrawalStatus) => {
    switch (status) {
      case 'waiting-to-prove': return 'Waiting to prove';
      case 'ready-to-prove': return 'Ready to prove';
      case 'waiting-to-finalize': return 'Challenge period';
      case 'ready-to-finalize': return 'Ready to finalize';
      case 'finalized': return 'Completed';
      default: return status;
    }
  };

  return (
    <>
    <SectionCard title="Bridge Tokens">
      {isPaused && <PausedWarning />}
      <p className="text-xs sm:text-sm text-gray-600">
        Transfer tokens between Ethereum L1 (Sepolia) and Celo L2.
      </p>

      {/* Direction Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setDirection('l1-to-l2')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
            direction === 'l1-to-l2'
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <img src="/images/ethereum.png" alt="Ethereum" className="w-4 h-4 rounded" />
            <ArrowRightLeft className="w-3 h-3" />
            <img src="/images/celo.png" alt="Celo" className="w-4 h-4 rounded" />
          </div>
          <div className="mt-1">L1 → L2</div>
        </button>
        <button
          onClick={() => setDirection('l2-to-l1')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
            direction === 'l2-to-l1'
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <img src="/images/celo.png" alt="Celo" className="w-4 h-4 rounded" />
            <ArrowRightLeft className="w-3 h-3" />
            <img src="/images/ethereum.png" alt="Ethereum" className="w-4 h-4 rounded" />
          </div>
          <div className="mt-1">L2 → L1</div>
        </button>
      </div>

      {/* L2->L1 Warning */}
      {direction === 'l2-to-l1' && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-medium">L2 → L1 withdrawals require multiple steps:</p>
            <ol className="list-decimal list-inside mt-1 space-y-0.5">
              <li>Initiate withdrawal on Celo</li>
              <li>Wait ~1 hour for state root</li>
              <li>Prove withdrawal on Ethereum</li>
              <li>Wait 7-day challenge period</li>
              <li>Finalize and claim tokens</li>
            </ol>
          </div>
        </div>
      )}

      {/* Pending Withdrawals List */}
      {tokenWithdrawals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Pending Withdrawals</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tokenWithdrawals.map((withdrawal) => (
              <button
                key={withdrawal.l2TxHash}
                onClick={() => openWithdrawalModal(withdrawal)}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatDisplayNumber((Number(withdrawal.amount) / 10 ** withdrawal.tokenDecimals).toString())} {withdrawal.tokenSymbol}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(withdrawal.status)}`}>
                      {getStatusLabel(withdrawal.status)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(withdrawal.initiatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  TX: {withdrawal.l2TxHash.slice(0, 10)}...{withdrawal.l2TxHash.slice(-8)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Balance Info */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs sm:text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Available to bridge:</span>
          <span className="font-medium">{formatDisplayNumber(sourceBalance)} {symbol}</span>
        </div>
      </div>

      {/* Amount Input */}
      <InputField
        label="Amount"
        value={amount}
        onChange={setAmount}
        placeholder="0.00"
        suffix={symbol}
        formatNumber
      />

      {/* Quick Amount Buttons */}
      <div className="flex gap-2">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => setAmount((parseFloat(sourceBalance) * pct / 100).toString())}
            className="flex-1 py-1.5 px-2 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
          >
            {pct}%
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && (
        <div className="text-green-500 text-xs sm:text-sm">
          <p>Bridge transaction submitted successfully!</p>
          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-600"
            >
              View on Etherscan
            </a>
          )}
          <p className="text-gray-500 mt-1">Note: Tokens may take a few minutes to appear on the destination chain.</p>
        </div>
      )}

      <ActionButton
        label={getButtonLabel()}
        onClick={handleBridge}
        disabled={!isValid || isPaused || isInitiating}
        loading={isLoading || isInitiating}
      />
    </SectionCard>

    {/* Bridge Progress Modal (L1->L2 only) */}
    <MultistepProgressModal
      title={`Bridging ${symbol} to Celo L2`}
      steps={bridgeSteps}
      currentStep={getCurrentStepNumber()}
      isOpen={direction === 'l1-to-l2' && (isLoading || isInitiating) && bridgeStep !== 'idle'}
      estimatedTime="2 min"
    />

    {/* Withdrawal Progress Modal (L2->L1) */}
    <WithdrawalProgressModal
      isOpen={showWithdrawalModal}
      onClose={() => {
        // Only allow closing if not in the middle of a transaction
        if (bridgeStep === 'idle') {
          setShowWithdrawalModal(false);
          setSelectedWithdrawal(null);
        }
      }}
      withdrawal={selectedWithdrawal}
      onWaitForProve={() => selectedWithdrawal ? waitForReadyToProve(selectedWithdrawal.l2TxHash) : Promise.resolve({ ready: false, error: 'No withdrawal' })}
      onProve={handleProve}
      onWaitForFinalize={() => selectedWithdrawal ? waitForReadyToFinalize(selectedWithdrawal.l2TxHash) : Promise.resolve({ ready: false, error: 'No withdrawal' })}
      onFinalize={handleFinalize}
      isProving={isProving}
      isFinalizing={isFinalizing}
      isInitiating={bridgeStep === 'bridging' || isInitiating}
      symbol={symbol}
      amount={selectedWithdrawal 
        ? (Number(selectedWithdrawal.amount) / 10 ** selectedWithdrawal.tokenDecimals).toString() 
        : amount || '0'}
    />
    </>
  );
};

// Transfer Ownership Section
interface TransferOwnershipSectionProps {
  onTransferOwnership: (newOwner: string) => Promise<{ success: boolean; error?: string }>;
  onAcceptOwnership: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isOwner: boolean;
  isPendingOwner: boolean;
  currentOwner: string;
  pendingOwner?: string;
  onSuccess?: () => void;
  // For Ethereum Enabled tokens
  isEthereumEnabled?: boolean;
  l2PendingOwner?: string;
}

// Steps for the transfer/accept ownership modals
const TRANSFER_OWNERSHIP_STEPS: MultistepProgressStep[] = [
  {
    title: 'Transfer on Ethereum',
    description: 'Initiating ownership transfer on L1',
    chain: 'ethereum',
  },
  {
    title: 'Transfer on Celo',
    description: 'Initiating ownership transfer on L2',
    chain: 'celo',
  },
];

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

const TransferOwnershipSection = ({ 
  onTransferOwnership, 
  onAcceptOwnership,
  isLoading, 
  isOwner, 
  isPendingOwner,
  currentOwner, 
  pendingOwner,
  onSuccess,
  isEthereumEnabled,
  l2PendingOwner,
}: TransferOwnershipSectionProps) => {
  const [newOwner, setNewOwner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [transferStep, setTransferStep] = useState(0);
  const [acceptStep, setAcceptStep] = useState(0);
  
  const isValid = newOwner.startsWith('0x') && newOwner.length === 42 && newOwner.toLowerCase() !== currentOwner.toLowerCase();
  const hasPendingTransfer = pendingOwner && pendingOwner !== '0x0000000000000000000000000000000000000000';
  const hasL2PendingTransfer = l2PendingOwner && l2PendingOwner !== '0x0000000000000000000000000000000000000000';

  const handleTransfer = async () => {
    setError(null);
    setSuccess(false);
    
    if (isEthereumEnabled) {
      setShowTransferModal(true);
      setTransferStep(1);
    }
    
    const result = await onTransferOwnership(newOwner);
    
    if (isEthereumEnabled) {
      if (result.success) {
        setTransferStep(3); // Completed
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferStep(0);
        }, 1500);
      } else if (result.error?.includes('L2')) {
        setTransferStep(2); // Failed at L2
      }
    }
    
    if (result.success) {
      setSuccess(true);
      setNewOwner('');
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setShowTransferModal(false);
      setTransferStep(0);
      setError(result.error || 'Transfer ownership failed');
    }
  };

  const handleAccept = async () => {
    setError(null);
    setSuccess(false);
    
    if (isEthereumEnabled) {
      setShowAcceptModal(true);
      setAcceptStep(1);
    }
    
    const result = await onAcceptOwnership();
    
    if (isEthereumEnabled) {
      if (result.success) {
        setAcceptStep(3); // Completed
        setTimeout(() => {
          setShowAcceptModal(false);
          setAcceptStep(0);
        }, 1500);
      } else if (result.error?.includes('L2')) {
        setAcceptStep(2); // Failed at L2
      }
    }
    
    if (result.success) {
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setShowAcceptModal(false);
      setAcceptStep(0);
      setError(result.error || 'Accept ownership failed');
    }
  };

  return (
    <>
    <SectionCard title="Transfer ownership">
      {!isOwner && !isPendingOwner && (
        <p className="text-amber-600 text-xs sm:text-sm bg-amber-50 p-2 rounded-lg">
          ⚠️ Only the current owner can transfer ownership.
        </p>
      )}
      <div className="text-xs sm:text-sm text-gray-600">
        <span className="font-medium">Current owner:</span>{' '}
        <span className="font-mono text-[10px] sm:text-xs break-all">{currentOwner}</span>
      </div>
      
      {/* Pending Owner Section */}
      {(hasPendingTransfer || (isEthereumEnabled && hasL2PendingTransfer)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-blue-700">
              Pending Transfer {isEthereumEnabled && '(Dual Chain)'}
            </span>
          </div>
          {isEthereumEnabled ? (
            <div className="space-y-1">
              <div className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">L1 Pending owner:</span>{' '}
                <span className="font-mono text-[10px] sm:text-xs break-all">
                  {hasPendingTransfer ? pendingOwner : 'None'}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">L2 Pending owner:</span>{' '}
                <span className="font-mono text-[10px] sm:text-xs break-all">
                  {hasL2PendingTransfer ? l2PendingOwner : 'None'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-gray-600">
              <span className="font-medium">Pending owner:</span>{' '}
              <span className="font-mono text-[10px] sm:text-xs break-all">{pendingOwner}</span>
            </div>
          )}
          {isPendingOwner && (
            <div className="pt-2">
              <p className="text-xs text-blue-600 mb-2">
                You are the pending owner. Click below to accept ownership
                {isEthereumEnabled && ' on both chains'}.
              </p>
              <ActionButton 
                label={isEthereumEnabled ? "Accept Ownership (Both Chains)" : "Accept Ownership"}
                onClick={handleAccept} 
                disabled={!isPendingOwner} 
                loading={isLoading} 
              />
            </div>
          )}
          {!isPendingOwner && isOwner && (
            <p className="text-xs text-gray-500">
              Waiting for the pending owner to accept the transfer.
            </p>
          )}
        </div>
      )}

      {/* Transfer Form - only show if no pending transfer or if owner wants to change */}
      {isOwner && (
        <>
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
          <ActionButton label="Transfer Ownership" onClick={handleTransfer} disabled={!isValid || !isOwner} loading={isLoading} />
        </>
      )}
      
      {error && <p className="text-red-500 text-xs sm:text-sm">{error}</p>}
      {success && <p className="text-green-500 text-xs sm:text-sm">✓ Operation completed successfully!</p>}
    </SectionCard>

    {/* Transfer Ownership Progress Modal */}
    {isEthereumEnabled && (
      <MultistepProgressModal
        title="Transferring Ownership"
        steps={TRANSFER_OWNERSHIP_STEPS}
        currentStep={transferStep}
        isOpen={showTransferModal}
        estimatedTime="1-2 min"
      />
    )}

    {/* Accept Ownership Progress Modal */}
    {isEthereumEnabled && (
      <MultistepProgressModal
        title="Accepting Ownership"
        steps={ACCEPT_OWNERSHIP_STEPS}
        currentStep={acceptStep}
        isOpen={showAcceptModal}
        estimatedTime="1-2 min"
      />
    )}
    </>
  );
};

// Token Info Header
interface TokenInfoHeaderProps {
  tokenAddress: string;
  name: string;
  symbol: string;
  isL2Token: boolean;
  totalSupply: string;
  maxSupply: string;
  userBalance: string;
  decimals: number;
  metadataURI?: string;
  // For Ethereum Enabled tokens - show both L1 and L2
  isEthereumEnabled?: boolean;
  l1TokenAddress?: string;
  l2TokenAddress?: string;
  l1TokenManager?: ReturnType<typeof useTokenManager>;
  l2TokenManager?: ReturnType<typeof useTokenManager>;
  // For Celo-Native tokens - show migration option
  isCeloNative?: boolean;
  isOwner?: boolean;
  logoUrl?: string;
  // Logo upload functionality
  onLogoChange?: (file: File) => void;
  isUploadingLogo?: boolean;
}

const TokenInfoHeader = ({ 
  tokenAddress, 
  name, 
  symbol, 
  isL2Token, 
  totalSupply, 
  maxSupply,
  userBalance, 
  decimals,
  metadataURI,
  isEthereumEnabled,
  l1TokenAddress,
  l2TokenAddress,
  l1TokenManager,
  l2TokenManager,
  isCeloNative,
  isOwner,
  logoUrl,
  onLogoChange,
  isUploadingLogo
}: TokenInfoHeaderProps) => {
  const navigate = useNavigate();
  // Calculate available to mint
  const calculateAvailableToMint = (total: string, max: string) => {
    const totalNum = parseFloat(total) || 0;
    const maxNum = parseFloat(max) || 0;
    if (maxNum === 0) return 'Unlimited';
    const available = maxNum - totalNum;
    return available > 0 ? available.toString() : '0';
  };
  // If Ethereum Enabled, show both tokens
  if (isEthereumEnabled && l1TokenAddress && l2TokenAddress && l1TokenManager && l2TokenManager) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <TokenLogo 
              logoUrl={logoUrl} 
              name={name} 
              symbol={symbol} 
              onLogoChange={onLogoChange}
              isUploading={isUploadingLogo}
              canEdit={isOwner}
            />
            <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
              {name} ({symbol})
            </h2>
          </div>
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
              <ReadOnlyField label="Max Supply" value={l1TokenManager.maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(l1TokenManager.maxSupply)} />
              <ReadOnlyField label="My Balance" value={formatDisplayNumber(l1TokenManager.userBalance)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
              <ReadOnlyField label="Available to Mint" value={l1TokenManager.maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(calculateAvailableToMint(l1TokenManager.totalSupply, l1TokenManager.maxSupply))} />
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
              <ReadOnlyField label="Max Supply" value={l2TokenManager.maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(l2TokenManager.maxSupply)} />
              <ReadOnlyField label="My Balance" value={formatDisplayNumber(l2TokenManager.userBalance)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
              <ReadOnlyField label="Available to Mint" value={l2TokenManager.maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(calculateAvailableToMint(l2TokenManager.totalSupply, l2TokenManager.maxSupply))} />
            </div>
          </div>
        </div>

        {/* Common Stats */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          <ReadOnlyField label="Decimals" value={decimals.toString()} />
        </div>
        {/* Metadata URI */}
        {(l2TokenManager?.metadataURI || l1TokenManager?.metadataURI) && (
          <div className="flex flex-col gap-2">
            <ReadOnlyField 
              label="Metadata URI" 
              value={l2TokenManager?.metadataURI || l1TokenManager?.metadataURI || ''} 
              onCopy={() => {}}
            />
          </div>
        )}
      </div>
    );
  }

  // Single token display (Celo-Native or fallback)
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <TokenLogo 
            logoUrl={logoUrl} 
            name={name} 
            symbol={symbol} 
            onLogoChange={onLogoChange}
            isUploading={isUploadingLogo}
            canEdit={isOwner}
          />
          <h2 className="text-lg sm:text-xl font-semibold text-black tracking-tight">
            {name} ({symbol})
          </h2>
        </div>
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

      {/* Migration Banner for Celo-Native tokens */}
      {isCeloNative && isL2Token && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Migrate to Ethereum</h4>
                <p className="text-xs text-gray-600">Enable cross-chain bridging by deploying on Ethereum L1</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/migrate?l2Token=${tokenAddress}`)}
              disabled={!isOwner}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                ${isOwner 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              <EthereumIcon />
              Migrate
            </button>
          </div>
          {!isOwner && (
            <p className="text-xs text-amber-600 mt-2">Only the token owner can perform migration.</p>
          )}
        </div>
      )}

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

      {/* Supply Info */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
        <ReadOnlyField label="Max Supply" value={maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(maxSupply)} />
        <ReadOnlyField label="Available to Mint" value={maxSupply === '0' ? 'Unlimited' : formatDisplayNumber(calculateAvailableToMint(totalSupply, maxSupply))} />
      </div>

      {/* Metadata URI */}
      <ReadOnlyField 
        label="Metadata URI" 
        value={metadataURI || 'Not set'} 
        onCopy={metadataURI ? () => {} : undefined}
      />
    </div>
  );
};

// Main Content Area
interface ContentAreaProps {
  activeSection: MenuSection;
  tokenManager: ReturnType<typeof useTokenManager>;
  onOperationSuccess?: () => void;
  connectedAddress?: string;
  // Bridge props (for Ethereum Enabled tokens)
  bridgeProps?: {
    l1TokenAddress: string;
    l2TokenAddress: string;
    l1Balance: string;
    l2Balance: string;
    decimals: number;
  };
  // For Ethereum Enabled tokens - dual chain operations
  isEthereumEnabled?: boolean;
  l2TokenManager?: ReturnType<typeof useTokenManager>;
}

const ContentArea = ({ activeSection, tokenManager, onOperationSuccess, connectedAddress, bridgeProps, isEthereumEnabled, l2TokenManager }: ContentAreaProps) => {
  const {
    symbol,
    isPaused,
    isOwner,
    isPendingOwner,
    isLoading,
    isSwitchingChain,
    userBalance,
    owner,
    pendingOwner,
    totalSupply,
    maxSupply,
    transfer,
    mint,
    burn,
    pause,
    unpause,
    transferOwnership,
    acceptOwnership,
  } = tokenManager;

  // Combine loading states for better UX
  const isOperationLoading = isLoading || isSwitchingChain || (l2TokenManager?.isLoading ?? false) || (l2TokenManager?.isSwitchingChain ?? false);

  // Dual-chain transfer ownership for Ethereum Enabled tokens
  const handleTransferOwnershipDual = async (newOwner: string): Promise<{ success: boolean; error?: string }> => {
    if (isEthereumEnabled && l2TokenManager) {
      // Transfer on L1 first
      const l1Result = await transferOwnership(newOwner);
      if (!l1Result.success) {
        return { success: false, error: `L1 transfer failed: ${l1Result.error}` };
      }

      // Then transfer on L2
      const l2Result = await l2TokenManager.transferOwnership(newOwner);
      if (!l2Result.success) {
        return { success: false, error: `L2 transfer failed: ${l2Result.error}. L1 was successful.` };
      }

      return { success: true };
    }

    // Single chain transfer
    return transferOwnership(newOwner);
  };

  // Dual-chain accept ownership for Ethereum Enabled tokens
  const handleAcceptOwnershipDual = async (): Promise<{ success: boolean; error?: string }> => {
    if (isEthereumEnabled && l2TokenManager) {
      // Check current ownership status on both chains to handle partial completion
      const l1IsOwner = isOwner;
      const l2IsOwner = l2TokenManager.isOwner;
      const l1IsPendingOwner = isPendingOwner;
      const l2IsPendingOwner = l2TokenManager.isPendingOwner;

      // If already owner on both, nothing to do
      if (l1IsOwner && l2IsOwner) {
        return { success: true };
      }

      // Accept on L1 only if not already owner and is pending owner
      if (!l1IsOwner) {
        if (l1IsPendingOwner) {
          const l1Result = await acceptOwnership();
          if (!l1Result.success) {
            return { success: false, error: `L1 accept failed: ${l1Result.error}` };
          }
        } else {
          return { success: false, error: 'Not pending owner on L1' };
        }
      } else {
        console.log('Already owner on L1, skipping L1 acceptance...');
      }

      // Accept on L2 only if not already owner and is pending owner
      if (!l2IsOwner) {
        if (l2IsPendingOwner) {
          const l2Result = await l2TokenManager.acceptOwnership();
          if (!l2Result.success) {
            return { success: false, error: `L2 accept failed: ${l2Result.error}. L1 was successful.` };
          }
        } else {
          return { success: false, error: 'Not pending owner on L2' };
        }
      } else {
        console.log('Already owner on L2, skipping L2 acceptance...');
      }

      return { success: true };
    }

    // Single chain accept
    return acceptOwnership();
  };

  // Dual-chain pause for Ethereum Enabled tokens
  const handlePauseDual = async (onStepChange?: (step: number) => void): Promise<{ success: boolean; error?: string }> => {
    if (isEthereumEnabled && l2TokenManager) {
      // Pause on L1 first (step 1)
      onStepChange?.(1);
      const l1Result = await pause();
      if (!l1Result.success) {
        return { success: false, error: `L1 pause failed: ${l1Result.error}` };
      }

      // Then pause on L2 (step 2)
      onStepChange?.(2);
      const l2Result = await l2TokenManager.pause();
      if (!l2Result.success) {
        return { success: false, error: `L2 pause failed: ${l2Result.error}. L1 was paused successfully.` };
      }

      return { success: true };
    }

    // Single chain pause
    return pause();
  };

  // Dual-chain unpause for Ethereum Enabled tokens
  const handleUnpauseDual = async (onStepChange?: (step: number) => void): Promise<{ success: boolean; error?: string }> => {
    if (isEthereumEnabled && l2TokenManager) {
      // Unpause on L1 first (step 1)
      onStepChange?.(1);
      const l1Result = await unpause();
      if (!l1Result.success) {
        return { success: false, error: `L1 unpause failed: ${l1Result.error}` };
      }

      // Then unpause on L2 (step 2)
      onStepChange?.(2);
      const l2Result = await l2TokenManager.unpause();
      if (!l2Result.success) {
        return { success: false, error: `L2 unpause failed: ${l2Result.error}. L1 was unpaused successfully.` };
      }

      return { success: true };
    }

    // Single chain unpause
    return unpause();
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'transfer':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <TransferSection 
              symbol={symbol || ''} 
              onTransfer={transfer}
              isLoading={isOperationLoading}
              userBalance={userBalance}
              onSuccess={onOperationSuccess}
              isPaused={isPaused}
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
              isLoading={isOperationLoading}
              isOwner={isOwner}
              onSuccess={onOperationSuccess}
              isPaused={isPaused}
              connectedAddress={connectedAddress}
              totalSupply={totalSupply}
              maxSupply={maxSupply}
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
              isLoading={isOperationLoading}
              userBalance={userBalance}
              onSuccess={onOperationSuccess}
              isPaused={isPaused}
            />
          </div>
        );
      case 'pause':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Contract Status</h3>
            <PauseSection 
              isPaused={isPaused} 
              onPause={handlePauseDual}
              onUnpause={handleUnpauseDual}
              isLoading={isOperationLoading}
              isOwner={isOwner}
              onSuccess={onOperationSuccess}
              isEthereumEnabled={isEthereumEnabled}
              l2IsPaused={l2TokenManager?.isPaused}
            />
          </div>
        );
      case 'bridge':
        if (!bridgeProps) return null;
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Cross-Chain Bridge</h3>
            <BridgeSection 
              symbol={symbol || ''}
              decimals={bridgeProps.decimals}
              l1TokenAddress={bridgeProps.l1TokenAddress}
              l2TokenAddress={bridgeProps.l2TokenAddress}
              l1Balance={bridgeProps.l1Balance}
              l2Balance={bridgeProps.l2Balance}
              onSuccess={onOperationSuccess}
              isPaused={isPaused}
            />
          </div>
        );
      case 'admin':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Ownership</h3>
            {isEthereumEnabled && (
              <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
                ℹ️ This is an Ethereum Enabled token. Ownership changes will be applied to both L1 and L2 tokens.
              </p>
            )}
            <TransferOwnershipSection 
              onTransferOwnership={handleTransferOwnershipDual}
              onAcceptOwnership={handleAcceptOwnershipDual}
              isLoading={isOperationLoading}
              isOwner={isOwner}
              isPendingOwner={isPendingOwner || (l2TokenManager?.isPendingOwner ?? false)}
              currentOwner={owner || ''}
              pendingOwner={pendingOwner}
              onSuccess={onOperationSuccess}
              isEthereumEnabled={isEthereumEnabled}
              l2PendingOwner={l2TokenManager?.pendingOwner}
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
  const [tokenLogoUrl, setTokenLogoUrl] = useState<string | undefined>(undefined);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { address } = useAccount();
  const { uploadLogo, logoUpdateTrigger } = useTokenLogo();

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
  // Priority: ethereum-enabled > L1 (Ethereum) > L2 (Celo)
  useEffect(() => {
    if (isEthereumEnabled) {
      // For ethereum-enabled, we always use L1 as primary for actions
      setIsL2Token(false);
    } else if (tokenManagerL1.name) {
      // Check L1 first (Ethereum Mainnet / Sepolia)
      setIsL2Token(false);
    } else if (tokenManagerL2.name) {
      // Fallback to L2 (Celo)
      setIsL2Token(true);
    }
  }, [tokenManagerL2.name, tokenManagerL1.name, isEthereumEnabled]);

  // Use the appropriate token manager for actions
  const tokenManager = isL2Token === false ? tokenManagerL1 : tokenManagerL2;

  // Fetch token logo - tries multiple extensions (png, jpg, webp, svg)
  useEffect(() => {
    if (!tokenAddress) return;
    
    // Use L2 address for logo (always exists)
    const l2Address = l2TokenFromParams || tokenAddress;
    
    // Try to find the logo with any supported extension
    findLogoUrl(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId, l2Address)
      .then(url => {
        if (url) {
          setTokenLogoUrl(url);
        }
      });
  }, [tokenAddress, l2TokenFromParams, logoUpdateTrigger]);

  // Handle logo upload
  const handleLogoChange = useCallback(async (file: File) => {
    if (!tokenAddress) return;
    
    setIsUploadingLogo(true);
    try {
      // Determine which chain to upload to
      const chainId = isEthereumEnabled 
        ? CONTRACTS.L1_TOKEN_FACTORY.chainId 
        : CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId;
      const addressToUse = isEthereumEnabled ? tokenAddress : (l2TokenFromParams || tokenAddress);
      
      const result = await uploadLogo(chainId, addressToUse, file);
      setTokenLogoUrl(result.url);
      
      // If ethereum-enabled, also upload for the other chain
      if (isEthereumEnabled && l2TokenFromParams) {
        try {
          await uploadLogo(CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId, l2TokenFromParams, file);
        } catch (e) {
          console.warn('Failed to upload logo for L2 token:', e);
        }
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  }, [tokenAddress, l2TokenFromParams, isEthereumEnabled, uploadLogo]);

  // Refresh all token data (both L1 and L2 for Ethereum Enabled tokens)
  const refreshAllTokenData = useCallback(async () => {
    if (isEthereumEnabled) {
      await Promise.all([tokenManagerL1.refetch(), tokenManagerL2.refetch()]);
    } else {
      await tokenManager.refetch();
    }
  }, [isEthereumEnabled, tokenManagerL1, tokenManagerL2, tokenManager]);

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
          isL2Token={isL2Token ?? false}
          totalSupply={tokenManager.totalSupply}
          maxSupply={tokenManager.maxSupply}
          userBalance={tokenManager.userBalance}
          decimals={tokenManager.decimals}
          metadataURI={tokenManager.metadataURI}
          isEthereumEnabled={isEthereumEnabled}
          l1TokenAddress={isEthereumEnabled ? tokenAddress : undefined}
          l2TokenAddress={isEthereumEnabled ? l2TokenFromParams || undefined : undefined}
          l1TokenManager={isEthereumEnabled ? tokenManagerL1 : undefined}
          l2TokenManager={isEthereumEnabled ? tokenManagerL2 : undefined}
          isCeloNative={!isEthereumEnabled && isL2Token === true}
          isOwner={tokenManager.isOwner}
          logoUrl={tokenLogoUrl}
          onLogoChange={handleLogoChange}
          isUploadingLogo={isUploadingLogo}
        />

        {/* Main Content */}
        <div className="flex flex-col md:flex-row gap-3 mt-3">
          <NavigationMenu 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
            showBridge={isEthereumEnabled}
          />
          <ContentArea 
            activeSection={activeSection} 
            tokenManager={tokenManager} 
            onOperationSuccess={refreshAllTokenData}
            connectedAddress={address}
            bridgeProps={isEthereumEnabled ? {
              l1TokenAddress: tokenAddress || '',
              l2TokenAddress: l2TokenFromParams || '',
              l1Balance: tokenManagerL1.userBalance,
              l2Balance: tokenManagerL2.userBalance,
              decimals: tokenManager.decimals,
            } : undefined}
            isEthereumEnabled={isEthereumEnabled}
            l2TokenManager={isEthereumEnabled ? tokenManagerL2 : undefined}
          />
        </div>
      </div>
    </div>
  );
}
