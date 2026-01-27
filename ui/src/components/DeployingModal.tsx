import { CheckIcon, ClockIcon } from './Icons';

// Local image paths
const imgEthereumSmall = "/images/ethereum-small.svg";
const imgCeloChain = "/images/celo-chain.svg";

type TokenType = 'celo-native' | 'ethereum-enabled' | null;

interface DeployingModalProps {
  tokenType: TokenType;
  currentStep: number; // From hook: 0=init, 1=L1/L2 creating, 2=minting (celo) or L2 creating (eth), 3=minting (eth) or bridge, 4=bridge (eth)
}

export function DeployingModal({ tokenType, currentStep }: DeployingModalProps) {
  const isEthereumEnabled = tokenType === 'ethereum-enabled';
  
  // Steps configuration matching the hook logic:
  // For ethereum-enabled: step 1 = L1 creating, step 2 = L2 creating, step 3 = minting, step 4 = bridge
  // For celo-native: step 1 = L2 creating, step 2 = minting
  const steps = isEthereumEnabled ? [
    { title: 'Creating L1 Token', description: 'Deploying token on Ethereum', chain: 'ethereum', hookStep: 1 },
    { title: 'Creating L2 Token', description: 'Deploying Superchain token on Celo', chain: 'celo', hookStep: 2 },
    { title: 'Minting Initial Supply', description: 'Minting initial tokens to your wallet', chain: 'celo', hookStep: 3 },
    { title: 'Configuring Bridge Connections', description: 'Setting up bridge between L1 and L2 tokens', chain: null, hookStep: 4 },
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
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl w-[456px] overflow-hidden shadow-xl animate-scale-in">
        {/* Header */}
        <div className="border-b border-gray-200 p-5">
          <h2 className="font-semibold text-lg text-black tracking-[-0.25px]">
            Deploying {isEthereumEnabled ? 'Ethereum Enabled' : 'Celo-Native'} Token
          </h2>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5">
          {/* Time estimate */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Deploying</span>
            <div className="flex items-center gap-1.5 text-gray-500">
              <ClockIcon className="w-4 h-4" />
              <span className="text-sm">~{isEthereumEnabled ? '4' : '2'} min</span>
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted 
                          ? 'bg-green-500' 
                          : isActive 
                            ? 'bg-green-100 border-2 border-green-500' 
                            : 'bg-gray-100'
                      }`}>
                        {isCompleted && (
                          <CheckIcon className="w-5 h-5 text-white" />
                        )}
                        {isActive && (
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      {/* Chain badge */}
                      {step.chain && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white overflow-hidden">
                          {step.chain === 'ethereum' ? (
                            <div className="w-full h-full bg-[#627eea] flex items-center justify-center">
                              <img src={imgEthereumSmall} alt="Ethereum" className="w-3 h-3" />
                            </div>
                          ) : (
                            <img src={imgCeloChain} alt="Celo" className="w-full h-full" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step info */}
                    <div className="flex-1 flex flex-col gap-0.5">
                      <p className={`font-medium text-base ${isCompleted || isActive ? 'text-black' : 'text-gray-400'}`}>
                        {step.title}
                      </p>
                      <p className={`text-sm ${isCompleted || isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="ml-5 py-2">
                      <div className={`w-0.5 h-6 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
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
