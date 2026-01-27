type Step = 'choose-type' | 'token-info' | 'review' | 'deploying' | 'success';

interface ProgressBarProps {
  step: Step;
}

export function ProgressBar({ step }: ProgressBarProps) {
  const getWidth = () => {
    switch (step) {
      case 'choose-type': return 'w-1/4';
      case 'token-info': return 'w-1/2';
      case 'review': return 'w-3/4';
      case 'deploying': 
      case 'success': return 'w-full';
      default: return 'w-1/4';
    }
  };

  return (
    <div className="bg-white border border-gray-200 h-2 rounded-full overflow-hidden w-full">
      <div className={`bg-green-500 h-full transition-all duration-500 ${getWidth()}`} />
    </div>
  );
}
