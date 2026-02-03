import { CheckIcon, ClockIcon } from './Icons';

export interface MultistepProgressStep {
  title: string;
  description: string;
  chain?: 'ethereum' | 'celo';
}

export interface MultistepProgressModalProps {
  title: string;
  steps: MultistepProgressStep[];
  currentStep: number; // 1-indexed step number (0 = not started)
  isOpen: boolean;
  estimatedTime?: string;
  isSwitchingChain?: boolean;
}

export function MultistepProgressModal({ 
  title, 
  steps, 
  currentStep, 
  isOpen, 
  estimatedTime = '2 min',
  isSwitchingChain 
}: MultistepProgressModalProps) {
  if (!isOpen) return null;

  const getStepStatus = (stepIndex: number) => {
    const stepNumber = stepIndex + 1;
    if (currentStep > stepNumber) return 'completed';
    if (currentStep === stepNumber) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl w-full max-w-[456px] overflow-hidden shadow-xl animate-scale-in">
        {/* Header */}
        <div className="border-b border-gray-200 p-3 sm:p-5">
          <h2 className="font-semibold text-base sm:text-lg text-black tracking-[-0.25px]">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 flex flex-col gap-4 sm:gap-5">
          {/* Time estimate */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs sm:text-sm">
              {isSwitchingChain ? 'Switching network...' : 'Processing...'}
            </span>
            <div className="flex items-center gap-1.5 text-gray-500">
              <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">~{estimatedTime}</span>
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
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
