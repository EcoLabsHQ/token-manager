import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from './Icons';

// Block explorer URLs
const SEPOLIA_EXPLORER = 'https://eth-sepolia.blockscout.com';
const CELO_SEPOLIA_EXPLORER = 'https://celo-sepolia.blockscout.com';

type TokenType = 'celo-native' | 'ethereum-enabled' | null;

interface TokenFormData {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
}

interface DeploymentResult {
  l1Address?: string;
  l2Address: string;
  txHash?: string;
}

interface SuccessModalProps {
  formData: TokenFormData;
  tokenType: TokenType;
  deploymentResult: DeploymentResult | null;
  onOpenDashboard: () => void;
}

// Helper to truncate address for display
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function SuccessModal({ formData, tokenType, deploymentResult, onOpenDashboard }: SuccessModalProps) {
  const isEthereumEnabled = tokenType === 'ethereum-enabled';
  
  const l1Address = deploymentResult?.l1Address || '';
  const l2Address = deploymentResult?.l2Address || '';
  
  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
  };
  
  const openExplorer = (address: string, chain: 'l1' | 'l2') => {
    const baseUrl = chain === 'l1' ? SEPOLIA_EXPLORER : CELO_SEPOLIA_EXPLORER;
    window.open(`${baseUrl}/address/${address}`, '_blank');
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl w-full max-w-[456px] overflow-hidden shadow-xl animate-scale-in">
        {/* Header */}
        <div className="p-3 sm:p-5 flex items-center justify-between">
          <h2 className="font-semibold text-base sm:text-lg text-black tracking-[-0.25px]">
            Deployment Successful
          </h2>
          <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
        </div>

        {/* Content */}
        <div className="px-3 sm:px-5 pb-3 sm:pb-5 flex flex-col gap-4 sm:gap-5">
          {/* Description */}
          <p className="text-gray-500 text-xs sm:text-sm leading-5">
            The <span className="font-semibold text-black">{formData.name} ({formData.symbol})</span> token has been successfully deployed on {isEthereumEnabled ? 'Ethereum (L1) and Celo (L2)' : 'Celo (L2)'}.
          </p>

          {/* Contract addresses */}
          <div className="flex flex-col gap-2 sm:gap-3">
            {isEthereumEnabled && l1Address && (
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <span className="font-semibold text-xs sm:text-sm text-black">L1 Token</span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded overflow-hidden flex-shrink-0">
                    <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs sm:text-sm text-black font-mono truncate">{truncateAddress(l1Address)}</span>
                  <button 
                    onClick={() => handleCopy(l1Address)}
                    className="p-0.5 sm:p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
                    title="Copy address"
                  >
                    <CopyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  </button>
                  <button 
                    onClick={() => openExplorer(l1Address, 'l1')}
                    className="p-0.5 sm:p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
                    title="View on Etherscan"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            {l2Address && (
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <span className="font-semibold text-xs sm:text-sm text-black">L2 Token</span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded overflow-hidden flex-shrink-0">
                    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs sm:text-sm text-black font-mono truncate">{truncateAddress(l2Address)}</span>
                  <button 
                    onClick={() => handleCopy(l2Address)}
                    className="p-0.5 sm:p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
                    title="Copy address"
                  >
                    <CopyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  </button>
                  <button 
                    onClick={() => openExplorer(l2Address, 'l2')}
                    className="p-0.5 sm:p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
                    title="View on Celo Explorer"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Open Dashboard Button */}
          <button 
            onClick={onOpenDashboard}
            className="w-full bg-black text-white h-10 sm:h-11 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Open Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
