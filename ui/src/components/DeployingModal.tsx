import { CheckIcon, ClockIcon } from './Icons';

type TokenType = 'celo-native' | 'ethereum-enabled' | null;

interface DeployingModalProps {
  tokenType: TokenType;
  currentStep: number; // From hook deployment step
  isSwitchingChain?: boolean; // Optional: show when switching chains
}

export function DeployingModal({ tokenType, currentStep, isSwitchingChain }: DeployingModalProps) {
  const isEthereumEnabled = tokenType === 'ethereum-enabled';

  // Steps configuration matching the hook logic:
  // Para ethereum-enabled:
  //   step 1 = L1 creating, step 2 = L2 creating, step 3 = bridge config, step 4 = approval, step 5 = bridge tokens
  // Para celo-native: step 1 = L2 creating, step 2 = minting
  const steps = isEthereumEnabled ? [
    { title: 'Creating L1 Token', description: 'Deploying token on Ethereum', chain: 'ethereum', hookStep: 1 },
    { title: 'Creating L2 Token', description: 'Deploying Superchain token on Celo', chain: 'celo', hookStep: 2 },
    { title: 'Configuring Bridge Connection', description: 'Setting up bridge between L1 and L2 tokens', chain: 'celo', hookStep: 3 },
    { title: 'Approval', description: 'Approving bridge to spend your tokens', chain: 'ethereum', hookStep: 4 },
    { title: 'Bridge L1 Tokens to L2', description: 'Transferring tokens from Ethereum to Celo', chain: 'ethereum', hookStep: 5 },
  ] : [
    { title: 'Creating L2 Token', description: 'Deploying token on Celo', chain: 'celo', hookStep: 1 },
    { title: 'Minting Initial Supply', description: 'Minting initial tokens to your wallet', chain: 'celo', hookStep: 2 },
  ];

  // Determine which step index is active based on hook's currentStep
  const getStepStatus = (stepHookValue: number) => {
    if (currentStep > stepHookValue) return 'completed';
    if (currentStep === stepHookValue) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl w-full max-w-[456px] overflow-hidden shadow-xl animate-scale-in">
        {/* Header */}
        <div className="border-b border-gray-200 p-3 sm:p-5">
          <h2 className="font-semibold text-base sm:text-lg text-black tracking-[-0.25px]">
            Deploying {isEthereumEnabled ? 'Ethereum Enabled' : 'Celo-Native'} Token
          </h2>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 flex flex-col gap-4 sm:gap-5">
          {/* Time estimate */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs sm:text-sm">
              {isSwitchingChain ? 'Switching network...' : 'Deploying'}
            </span>
            <div className="flex items-center gap-1.5 text-gray-500">
              <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">~{isEthereumEnabled ? '5' : '2'} min</span>
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col">
            {steps.map((step, index) => {
              const status = getStepStatus(step.hookStep);
              const isCompleted = status === 'completed';
              const isActive = status === 'active';
              
              return (
                <div key={index}>
                  <div className="flex items-center gap-3">
                    {/* Status icon with chain badge */}
                    <div className="relative">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted 
                          ? 'bg-green-500' 
                          : isActive 
                            ? 'bg-blue-50' 
                            : 'bg-gray-100'
                      }`}>
                        {isCompleted && (
                          <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        )}
                        {isActive && (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle 
                              className="opacity-25" 
                              cx="12" 
                              cy="12" 
                              r="10" 
                              stroke="#3B82F6" 
                              strokeWidth="3"
                            />
                            <path 
                              className="opacity-100" 
                              fill="#3B82F6" 
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                      </div>
                      {/* Chain badge */}
                      {step.chain && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded border-2 border-white overflow-hidden">
                          <img 
                            src={step.chain === 'ethereum' ? '/images/ethereum.png' : '/images/celo.png'}
                            alt={step.chain}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Step info */}
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <p className={`font-medium text-sm sm:text-base ${isCompleted || isActive ? 'text-black' : 'text-gray-400'}`}>
                        {step.title}
                      </p>
                      <p className={`text-xs sm:text-sm ${isCompleted || isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="ml-4 sm:ml-5 py-1.5 sm:py-2">
                      <div className={`w-0.5 h-5 sm:h-6 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
