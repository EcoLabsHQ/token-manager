import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from './Icons';

// Local image paths
const imgEthereumSmall = "/images/ethereum-small.svg";
const imgCeloChain = "/images/celo-chain.svg";

type TokenType = 'celo-native' | 'ethereum-enabled' | null;

interface TokenFormData {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
}

interface SuccessModalProps {
  formData: TokenFormData;
  tokenType: TokenType;
  onOpenDashboard: () => void;
}

// Mock contract addresses
const MOCK_L1_ADDRESS = "0x758D...FAB0";
const MOCK_L2_ADDRESS = "0x5e67...64B8";

export function SuccessModal({ formData, tokenType, onOpenDashboard }: SuccessModalProps) {
  const isEthereumEnabled = tokenType === 'ethereum-enabled';
  
  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl w-[456px] overflow-hidden shadow-xl animate-scale-in">
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-black tracking-[-0.25px]">
            Deployment Successful
          </h2>
          <CheckCircleIcon className="w-6 h-6 text-green-500" />
        </div>

        {/* Content */}
        <div className="px-5 pb-5 flex flex-col gap-5">
          {/* Description */}
          <p className="text-gray-500 text-sm leading-5">
            The <span className="font-semibold text-black">{formData.name} ({formData.symbol})</span> token has been successfully deployed on {isEthereumEnabled ? 'Ethereum (L1) and Celo (L2)' : 'Celo (L2)'}.
          </p>

          {/* Contract addresses */}
          <div className="flex flex-col gap-3">
            {isEthereumEnabled && (
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-sm text-black">L1 Token</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#627eea] flex items-center justify-center">
                    <img src={imgEthereumSmall} alt="Ethereum" className="w-3 h-3" />
                  </div>
                  <span className="text-sm text-black font-mono">{MOCK_L1_ADDRESS}</span>
                  <button 
                    onClick={() => handleCopy(MOCK_L1_ADDRESS)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                  >
                    <CopyIcon className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                    <ExternalLinkIcon className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-sm text-black">L2 Token</span>
              <div className="flex items-center gap-2">
                <img src={imgCeloChain} alt="Celo" className="w-5 h-5 rounded-full" />
                <span className="text-sm text-black font-mono">{MOCK_L2_ADDRESS}</span>
                <button 
                  onClick={() => handleCopy(MOCK_L2_ADDRESS)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                >
                  <CopyIcon className="w-4 h-4 text-gray-400" />
                </button>
                <button className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                  <ExternalLinkIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Open Dashboard Button */}
          <button 
            onClick={onOpenDashboard}
            className="w-full bg-black text-white h-11 rounded-lg font-medium text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Open Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
