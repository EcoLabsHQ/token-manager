import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, ArrowLeft } from 'lucide-react';
import { useTokenStorage, type Token } from '../hooks';

// Chain icons
const EthereumIcon = () => (
  <div className="w-7 h-7 rounded-lg bg-[#627eea] flex items-center justify-center border-[1.5px] border-white shadow-sm">
    <svg width="12" height="18" viewBox="0 0 8 13" fill="none">
      <path d="M4 0L0 6.5L4 8.5L8 6.5L4 0Z" fill="white" fillOpacity="0.6" />
      <path d="M4 9.5L0 7.5L4 13L8 7.5L4 9.5Z" fill="white" />
    </svg>
  </div>
);

const CeloIcon = () => (
  <div className="w-7 h-7 rounded-lg bg-[#fcff52] flex items-center justify-center border-[1.5px] border-white shadow-sm">
    <svg width="14" height="14" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    </svg>
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
    <div className="bg-white border border-gray-200 rounded-2xl p-5 w-56 flex flex-col gap-5">
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
}

const InputField = ({ label, value, onChange, placeholder, suffix, disabled, readOnly }: InputFieldProps) => (
  <div className="flex flex-col gap-1.5 flex-1">
    <label className="text-sm text-gray-500 leading-relaxed">{label}</label>
    <div className={`border border-gray-300 rounded-md flex items-center px-2.5 py-2 ${disabled ? 'bg-gray-50' : 'bg-white'}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className="flex-1 text-sm text-black outline-none bg-transparent placeholder:text-gray-400"
      />
      {suffix && <span className="text-sm text-black ml-2">{suffix}</span>}
    </div>
  </div>
);

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
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-sm text-gray-500 leading-relaxed">{label}</label>
      <div className="border border-gray-300 rounded-md flex items-center px-2.5 py-2 bg-white">
        <span className="flex-1 text-sm text-black font-mono truncate">{value}</span>
        {onCopy && (
          <button
            onClick={handleCopy}
            className="p-1 rounded transition-colors hover:bg-gray-100 cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400 hover:text-gray-600" />
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
}

const ActionButton = ({ label, onClick, disabled, variant = 'primary' }: ActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`h-9 px-3.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer
      ${disabled
        ? 'bg-black/15 text-white cursor-not-allowed'
        : variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
          : 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
      }
      focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2`}
  >
    {label}
  </button>
);

// Section Card Component
interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

const SectionCard = ({ title, children }: SectionCardProps) => (
  <div className="border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
    <h4 className="text-sm font-semibold text-black tracking-tight">{title}</h4>
    {children}
  </div>
);

// Transfer Section
interface TransferSectionProps {
  symbol: string;
}

const TransferSection = ({ symbol }: TransferSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && parseFloat(amount) > 0;

  return (
    <SectionCard title="Transfer">
      <div className="flex gap-3">
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
          placeholder="123456"
          suffix={symbol}
        />
      </div>
      <ActionButton label="Transfer" onClick={() => {}} disabled={!isValid} />
    </SectionCard>
  );
};

// Mint Section
interface MintSectionProps {
  symbol: string;
}

const MintSection = ({ symbol }: MintSectionProps) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && parseFloat(amount) > 0;

  return (
    <SectionCard title="Mint">
      <div className="flex gap-3">
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
          placeholder="123456"
          suffix={symbol}
        />
      </div>
      <ActionButton label="Mint" onClick={() => {}} disabled={!isValid} />
    </SectionCard>
  );
};

// Burn Section
interface BurnSectionProps {
  symbol: string;
}

const BurnSection = ({ symbol }: BurnSectionProps) => {
  const [amount, setAmount] = useState('');
  
  const isValid = parseFloat(amount) > 0;

  return (
    <SectionCard title="Burn">
      <InputField
        label="Amount"
        value={amount}
        onChange={setAmount}
        placeholder="123456"
        suffix={symbol}
      />
      <ActionButton label="Burn" onClick={() => {}} disabled={!isValid} variant="danger" />
    </SectionCard>
  );
};

// Pause Section
interface PauseSectionProps {
  isPaused: boolean;
  onToggle: () => void;
}

const PauseSection = ({ isPaused, onToggle }: PauseSectionProps) => {
  return (
    <SectionCard title="Pause Contract">
      <p className="text-sm text-gray-600">
        {isPaused
          ? 'The contract is currently paused. All transfers are disabled.'
          : 'Pause the contract to disable all token transfers.'}
      </p>
      <ActionButton
        label={isPaused ? 'Unpause' : 'Pause'}
        onClick={onToggle}
        variant={isPaused ? 'primary' : 'danger'}
      />
    </SectionCard>
  );
};

// Transfer Ownership Section
const TransferOwnershipSection = () => {
  const [newOwner, setNewOwner] = useState('');
  
  const isValid = newOwner.startsWith('0x') && newOwner.length === 42;

  return (
    <SectionCard title="Transfer ownership">
      <InputField
        label="To"
        value={newOwner}
        onChange={setNewOwner}
        placeholder="0x..."
      />
      <ActionButton label="Transfer Ownership" onClick={() => {}} disabled={!isValid} />
    </SectionCard>
  );
};

// Token Info Header
interface TokenInfoHeaderProps {
  token: Token;
}

const TokenInfoHeader = ({ token }: TokenInfoHeaderProps) => {
  const fullAddressL1 = token.addressL1?.replace('...', '758Db586E85AC2D007d499610937f25594fa') || '';
  const fullAddressL2 = token.addressL2?.replace('...', '4r34Db586E85AC2D007d499610937f255943') || '';

  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black tracking-tight">
          {token.name} ({token.symbol})
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {token.type === 'ethereum-enabled' ? 'Ethereum Enabled' : 'Celo-Native'}
          </span>
          <div className="flex items-center">
            {token.type === 'ethereum-enabled' ? (
              <>
                <EthereumIcon />
                <div className="-ml-1.5">
                  <CeloIcon />
                </div>
              </>
            ) : (
              <CeloIcon />
            )}
          </div>
        </div>
      </div>

      {/* Token Address */}
      <ReadOnlyField
        label="Token address"
        value={token.type === 'ethereum-enabled' ? fullAddressL1 : fullAddressL2}
        onCopy={() => {}}
      />

      {/* Stats */}
      <div className="flex gap-2.5">
        <ReadOnlyField label="Decimals" value="18" />
        <ReadOnlyField label="Total Supply" value={token.maxSupply} />
        <ReadOnlyField label="My Balance" value="1,000,000" />
      </div>
    </div>
  );
};

// Main Content Area
interface ContentAreaProps {
  activeSection: MenuSection;
  token: Token;
}

const ContentArea = ({ activeSection, token }: ContentAreaProps) => {
  const [isPaused, setIsPaused] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case 'transfer':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <TransferSection symbol={token.symbol} />
          </div>
        );
      case 'mint':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <MintSection symbol={token.symbol} />
          </div>
        );
      case 'burn':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">General</h3>
            <BurnSection symbol={token.symbol} />
          </div>
        );
      case 'pause':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Contract Status</h3>
            <PauseSection isPaused={isPaused} onToggle={() => setIsPaused(!isPaused)} />
          </div>
        );
      case 'admin':
        return (
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-semibold text-black">Ownership</h3>
            <TransferOwnershipSection />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 flex-1 flex flex-col">
      {renderContent()}
    </div>
  );
};

// Main TokenManager Component
export default function TokenManager() {
  const { tokenAddress } = useParams<{ tokenAddress: string }>();
  const navigate = useNavigate();
  const { tokens } = useTokenStorage();
  const [activeSection, setActiveSection] = useState<MenuSection>('transfer');

  // Find the token by address
  const token = tokens.find(
    (t) => t.addressL1 === tokenAddress || t.addressL2 === tokenAddress || t.id === tokenAddress
  );

  if (!token) {
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
            The token you're looking for doesn't exist or has been removed.
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
    <div className="bg-gray-100 flex flex-col flex-1 min-h-0 w-full p-6 animate-fade-in items-center">
      <div className="w-full max-w-[960px]">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Token Info Header */}
        <TokenInfoHeader token={token} />

        {/* Main Content */}
        <div className="flex gap-3 mt-3">
          <NavigationMenu activeSection={activeSection} onSectionChange={setActiveSection} />
          <ContentArea activeSection={activeSection} token={token} />
        </div>
      </div>
    </div>
  );
}
