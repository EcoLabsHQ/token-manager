import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';

// Local image paths
const imgVector = "/images/logo.svg";
const imgIcons = "/images/network-icon.svg";
const imgChevronDown = "/images/chevron-down.svg";

// Wallet icon component
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

// Format address for display
function formatAddress(address: string): string {
  if (address.endsWith('.eth')) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Nav() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  return (
    <nav className="bg-white flex items-center justify-between px-6 py-4.5 shadow-[1px_2px_9px_0px_rgba(0,0,0,0.03)] w-full">
      {/* Logo */}
      <div className="flex items-center">
        <div className="flex items-center px-3 gap-1.5">
          <img 
            src={imgVector} 
            alt="Logo" 
            className="w-[18.7px] h-[20.9px]" 
          />
          <span className="font-semibold text-[19.8px] text-black tracking-[-0.55px]">
            Celo Token Manager
          </span>
        </div>
      </div>

      {/* Right side - Network selector and wallet */}
      <div className="flex items-center gap-2">
        {/* Network selector button */}
        <button 
          onClick={() => open({ view: 'Networks' })}
          className="bg-white border border-gray-200 flex items-center gap-1 h-9 px-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <img src={imgIcons} alt="Network" className="w-5 h-5" />
          {caipNetwork && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {caipNetwork.name}
            </span>
          )}
          <img src={imgChevronDown} alt="Expand" className="w-2 h-1" />
        </button>

        {/* Wallet button */}
        {isConnected && address ? (
          <button 
            onClick={() => open({ view: 'Account' })}
            className="bg-white border border-gray-200 flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {address.slice(2, 4).toUpperCase()}
              </span>
            </div>
            <span className="font-medium text-[13px] text-black tracking-[0.25px]">
              {formatAddress(address)}
            </span>
          </button>
        ) : (
          <button 
            onClick={() => open()}
            className="bg-black text-white flex items-center gap-1.5 h-9 px-4 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <WalletIcon className="w-4 h-4" />
            <span className="font-medium text-[13px] tracking-[0.25px]">
              Connect Wallet
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
