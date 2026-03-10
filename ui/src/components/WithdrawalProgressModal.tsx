import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Check } from 'lucide-react';
import type { PendingWithdrawalStorage } from '@/hooks/usePendingWithdrawals';

interface WithdrawalProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  withdrawal: PendingWithdrawalStorage | null;
  onWaitForProve: () => Promise<{ ready: boolean; error?: string }>;
  onProve: () => Promise<void>;
  onWaitForFinalize: () => Promise<{ ready: boolean; error?: string }>;
  onFinalize: () => Promise<void>;
  isProving: boolean;
  isFinalizing: boolean;
  isInitiating?: boolean;
  symbol: string;
  amount: string;
}

type Phase = 'initiating' | 'waiting-prove' | 'proving' | 'waiting-finalize' | 'finalizing' | 'complete';

interface Step {
  id: string;
  title: string;
  description: string;
  chain: 'celo' | 'ethereum';
}

const STEPS: Step[] = [
  { id: 'initiate', title: 'Initiate withdrawal', description: 'Start withdrawal on L2', chain: 'celo' },
  { id: 'wait-prove', title: 'Wait for state root', description: 'State root publication (~1 hour)', chain: 'ethereum' },
  { id: 'prove', title: 'Prove on Ethereum', description: 'Submit proof to L1', chain: 'ethereum' },
  { id: 'wait-finalize', title: 'Wait for challenge period', description: 'Security period (~7 days)', chain: 'ethereum' },
  { id: 'finalize', title: 'Finalize withdrawal', description: 'Claim tokens on L1', chain: 'ethereum' },
];

function StepIcon({ status, chain }: { status: 'pending' | 'active' | 'completed'; chain: 'celo' | 'ethereum' }) {
  return (
    <div className="relative">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        status === 'completed' ? 'bg-green-500' : 
        status === 'active' ? 'bg-blue-50' : 'bg-gray-100'
      }`}>
        {status === 'completed' && <Check className="w-5 h-5 text-white" />}
        {status === 'active' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded border-2 border-white overflow-hidden">
        <img src={chain === 'ethereum' ? '/images/ethereum.png' : '/images/celo.png'} alt={chain} className="w-full h-full" />
      </div>
    </div>
  );
}

export function WithdrawalProgressModal({
  isOpen,
  onClose,
  withdrawal,
  onWaitForProve,
  onProve,
  onWaitForFinalize,
  onFinalize,
  isProving,
  isFinalizing,
  isInitiating: _isInitiating = false,
  symbol,
  amount,
}: WithdrawalProgressModalProps) {
  const [phase, setPhase] = useState<Phase>('initiating');
  const [error, setError] = useState<string | null>(null);

  // Determine current phase based on state
  useEffect(() => {
    if (!withdrawal?.l2TxHash) {
      setPhase('initiating');
      return;
    }

    // Auto-advance through phases
    const runPhase = async () => {
      try {
        setError(null);

        // Phase 1: Wait for prove
        if (phase === 'initiating' && withdrawal?.l2TxHash) {
          setPhase('waiting-prove');
        }

        if (phase === 'waiting-prove' && !isProving) {
          console.log('Waiting for withdrawal to be provable...');
          const result = await onWaitForProve();
          if (result.ready) {
            setPhase('proving');
            await onProve();
            setPhase('waiting-finalize');
          } else if (result.error) {
            setError(result.error);
          }
        }

        if (phase === 'waiting-finalize' && !isFinalizing) {
          console.log('Waiting for withdrawal to be finalizable...');
          const result = await onWaitForFinalize();
          if (result.ready) {
            setPhase('finalizing');
            await onFinalize();
            setPhase('complete');
          } else if (result.error) {
            setError(result.error);
          }
        }
      } catch (err) {
        console.error('Phase error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    runPhase();
  }, [withdrawal?.l2TxHash, phase, isProving, isFinalizing, onWaitForProve, onProve, onWaitForFinalize, onFinalize]);

  // Reset phase when modal opens with new withdrawal
  useEffect(() => {
    if (isOpen && !withdrawal?.l2TxHash) {
      setPhase('initiating');
      setError(null);
    }
  }, [isOpen, withdrawal?.l2TxHash]);

  const getStepStatus = (stepId: string): 'pending' | 'active' | 'completed' => {
    const stepOrder = ['initiate', 'wait-prove', 'prove', 'wait-finalize', 'finalize'];
    const stepIndex = stepOrder.indexOf(stepId);
    
    const phaseToStep: Record<Phase, number> = {
      'initiating': 0,
      'waiting-prove': 1,
      'proving': 2,
      'waiting-finalize': 3,
      'finalizing': 4,
      'complete': 5,
    };
    
    const currentStepIndex = phaseToStep[phase];
    
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Bridge {amount} {symbol} to L1</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="p-4">
          <div className="flex flex-col">
            {STEPS.map((step, index) => {
              const status = getStepStatus(step.id);
              
              return (
                <div key={step.id}>
                  <div className="flex items-start gap-3">
                    <StepIcon status={status} chain={step.chain} />
                    <div className="flex-1 pt-1">
                      <p className={`font-medium ${status === 'pending' ? 'text-gray-400' : 'text-black'}`}>
                        {step.id === 'finalize' ? `Get ${amount} ${symbol} on Ethereum` : step.title}
                      </p>
                      <p className={`text-sm ${status === 'pending' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {step.description}
                      </p>
                      {step.id === 'initiate' && withdrawal?.l2TxHash && (
                        <a
                          href={`https://alfajores.celoscan.io/tx/${withdrawal.l2TxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 flex items-center gap-1 mt-1"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="ml-5 py-2">
                      <div className={`w-0.5 h-6 ${status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Status */}
          {phase === 'complete' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm">✅ Withdrawal complete! Your tokens are now on L1.</p>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-xs">
              ⚠️ L2→L1 withdrawals require ~7 days for security. The process will auto-advance when ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
