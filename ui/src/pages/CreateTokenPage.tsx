import { useNavigate } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useCreateToken } from '../hooks/useCreateToken';
import { ProgressBar, TokenTypeCard, DeployingModal, SuccessModal, InfoIcon } from '../components';
import { formatNumberWithCommas, parseFormattedNumber, formatDisplayNumber } from '../lib/utils';
import type { TokenType } from '../lib/schemas';
import { Controller, type UseFormReturn } from 'react-hook-form';
import type { TokenFormData } from '../lib/schemas';

// ===== STEP 1: Choose Token Type =====
function ChooseTokenType({
  selectedType,
  onSelectType,
  onContinue,
  onCancel,
  hasResumableDeployment,
  onResume,
  onCancelResume,
}: {
  selectedType: TokenType | null;
  onSelectType: (type: TokenType) => void;
  onContinue: () => void;
  onCancel: () => void;
  hasResumableDeployment?: boolean;
  onResume?: () => void;
  onCancelResume?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-[456px] px-2 sm:px-0">
      {/* Resume Banner */}
      {hasResumableDeployment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-amber-900 text-xs sm:text-sm">Incomplete Deployment Found</h3>
              <p className="text-amber-700 text-xs sm:text-sm mt-1">
                You have a token deployment in progress. Would you like to resume where you left off?
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-9 sm:ml-11">
            <button
              onClick={onCancelResume}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={onResume}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Resume Deployment
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <h1 className="font-semibold text-xl sm:text-[26px] text-black tracking-[-0.25px] leading-tight sm:leading-[34px]">
          Choose Token Type
        </h1>
        <p className="text-gray-500 text-sm sm:text-base leading-5">
          Select how your token will be deployed and used across the Celo ecosystem.
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar step="choose-type" />

      {/* Token Type Options */}
      <div className="flex flex-col gap-2 stagger-children">
        <TokenTypeCard
          type="celo-native"
          title="Celo-Native"
          description="Fast, cheap, and easy to deploy on the Celo Network."
          price="100 CELO"
          features={[
            'Deploys on Celo L2 only',
            'No bridge configuration required',
            'Ideal for ecosystem-specific or experimental tokens',
            'Instantly available on L2',
            'Can be upgraded to Ethereum Enabled later',
          ]}
          selected={selectedType === 'celo-native'}
          onSelect={() => onSelectType('celo-native')}
        />

        <TokenTypeCard
          type="ethereum-enabled"
          title="Ethereum Enabled"
          description="Institutional-grade assets, secured by Ethereum L1 and optimized for interopability."
          price="1,000 CELO"
          features={[
            'Deploys on Ethereum (L1) and Celo (L2)',
            'Automatic bridge configuration included',
            'Enables cross-chain transfers',
            'Designed for long-term and production use',
          ]}
          selected={selectedType === 'ethereum-enabled'}
          onSelect={() => onSelectType('ethereum-enabled')}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 sm:gap-3">
        <button
          onClick={onCancel}
          className="bg-gray-50 border border-gray-300 text-black h-9 sm:h-10 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-100 transition-colors cursor-pointer flex-1"
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          disabled={!selectedType}
          className="flex-1 bg-black text-white h-9 sm:h-10 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ===== STEP 2: Token Information =====
function TokenInformation({
  form,
  onBack,
  onContinue,
}: {
  form: UseFormReturn<TokenFormData>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { register, formState: { errors, isValid }, watch, setValue } = form;
  const decimals = watch('decimals');

  const handleContinue = async () => {
    const valid = await form.trigger();
    if (valid) {
      onContinue();
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-[456px] px-2 sm:px-0 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1.5 sm:gap-2 animate-slide-up">
        <h1 className="font-semibold text-xl sm:text-[26px] text-black tracking-[-0.25px] leading-tight sm:leading-[34px]">
          Token Information
        </h1>
        <p className="text-gray-500 text-sm sm:text-base leading-5">Configure the core properties of your token.</p>
      </div>

      {/* Progress bar */}
      <ProgressBar step="token-info" />

      {/* Form */}
      <div className="bg-white border border-gray-200 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl w-full animate-slide-up" style={{ animationDelay: '50ms' }}>
        {/* Token Name */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-500 text-xs sm:text-sm">Token Name</label>
          <input
            type="text"
            placeholder="e.g., My Token"
            {...register('name')}
            className={`bg-gray-50 border rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.name && (
            <span className="text-red-500 text-[10px] sm:text-xs">{errors.name.message}</span>
          )}
        </div>

        {/* Token Symbol */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-500 text-xs sm:text-sm">Token Symbol</label>
          <input
            type="text"
            placeholder="e.g., MTK"
            {...register('symbol', {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase();
              }
            })}
            className={`bg-gray-50 border rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
              errors.symbol ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.symbol && (
            <span className="text-red-500 text-[10px] sm:text-xs">{errors.symbol.message}</span>
          )}
        </div>

        {/* Initial Supply & Max Supply */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Initial Supply</label>
            <Controller
              name="initialSupply"
              control={form.control}
              render={({ field }) => (
                <input
                  type="text"
                  placeholder="e.g., 1,000,000"
                  value={formatNumberWithCommas(field.value || '')}
                  onChange={(e) => {
                    const rawValue = parseFormattedNumber(e.target.value);
                    if (rawValue === '' || /^\d*$/.test(rawValue)) {
                      field.onChange(rawValue);
                    }
                  }}
                  onBlur={field.onBlur}
                  className={`bg-gray-50 border rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.initialSupply ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              )}
            />
            {errors.initialSupply && (
              <span className="text-red-500 text-[10px] sm:text-xs">{errors.initialSupply.message}</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Max Supply</label>
            <Controller
              name="maxSupply"
              control={form.control}
              render={({ field }) => (
                <input
                  type="text"
                  placeholder="e.g., 10,000,000"
                  value={formatNumberWithCommas(field.value || '')}
                  onChange={(e) => {
                    const rawValue = parseFormattedNumber(e.target.value);
                    if (rawValue === '' || /^\d*$/.test(rawValue)) {
                      field.onChange(rawValue);
                    }
                  }}
                  onBlur={field.onBlur}
                  className={`bg-gray-50 border rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.maxSupply ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              )}
            />
            {errors.maxSupply && (
              <span className="text-red-500 text-[10px] sm:text-xs">{errors.maxSupply.message}</span>
            )}
          </div>
        </div>

        {/* Decimals */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-500 text-xs sm:text-sm flex items-center gap-1">
            Decimals
            <InfoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={decimals}
              readOnly
              className="flex-1 border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black bg-white"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setValue('decimals', Math.min(decimals + 1, 18))}
                className="bg-gray-50 border border-gray-300 rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 cursor-pointer text-sm sm:text-base"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setValue('decimals', Math.max(decimals - 1, 0))}
                className={`bg-gray-50 border border-gray-300 rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 text-sm sm:text-base ${decimals <= 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={decimals <= 0}
              >
                -
              </button>
            </div>
          </div>
          {errors.decimals && (
            <span className="text-red-500 text-[10px] sm:text-xs">{errors.decimals.message}</span>
          )}
        </div>
      </div>

      {/* Form-level error (e.g., maxSupply < initialSupply) */}
      {errors.root && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 text-red-600 text-xs sm:text-sm">
          {errors.root.message}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-50 border border-gray-300 text-black h-9 sm:h-10 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-100 transition-colors cursor-pointer flex-1"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!isValid}
          className={`flex-1 bg-black text-white h-9 sm:h-10 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors ${!isValid ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          Review and Deploy
        </button>
      </div>
    </div>
  );
}

// ===== STEP 3: Review =====
function Review({
  form,
  tokenType,
  onBack,
  onDeploy,
  deployError,
  isConnected,
  onConnectWallet,
}: {
  form: UseFormReturn<TokenFormData>;
  tokenType: TokenType | null;
  onBack: () => void;
  onDeploy: () => void;
  deployError: string | null;
  isConnected: boolean;
  onConnectWallet: () => void;
}) {
  const { watch } = form;
  const formData = watch();
  const deploymentCost = tokenType === 'ethereum-enabled' ? '1,000 CELO ($120.00)' : '100 CELO ($12.00)';

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-[456px] px-2 sm:px-0 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1.5 sm:gap-2 animate-slide-up">
        <h1 className="font-semibold text-xl sm:text-[26px] text-black tracking-[-0.25px] leading-tight sm:leading-[34px]">Review</h1>
        <p className="text-gray-500 text-sm sm:text-base leading-5">Review your token configuration before deployment.</p>
      </div>

      {/* Progress bar */}
      <ProgressBar step="review" />

      {/* Review Cards */}
      <div className="flex flex-col gap-2 sm:gap-3 stagger-children">
        {/* Token Info Card */}
        <div className="bg-white border border-gray-200 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl w-full">
          {/* Token Name */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Token Name</label>
            <div className="border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2">
              <p className="text-xs sm:text-sm text-black">{formData.name}</p>
            </div>
          </div>

          {/* Token Symbol */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Token Symbol</label>
            <div className="border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2">
              <p className="text-xs sm:text-sm text-black">{formData.symbol}</p>
            </div>
          </div>

          {/* Initial Supply & Max Supply */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-500 text-xs sm:text-sm flex items-center gap-1">
                Initial Supply
                <InfoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              </label>
              <div className="border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2">
                <p className="text-xs sm:text-sm text-black">{formatDisplayNumber(formData.initialSupply)}</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-500 text-xs sm:text-sm flex items-center gap-1">
                Max Supply
                <InfoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              </label>
              <div className="border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2">
                <p className="text-xs sm:text-sm text-black">{formatDisplayNumber(formData.maxSupply)}</p>
              </div>
            </div>
          </div>

          {/* Decimals */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm flex items-center gap-1">
              Decimals
              <InfoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
            </label>
            <div className="border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2">
              <p className="text-xs sm:text-sm text-black">{formData.decimals}</p>
            </div>
          </div>
        </div>

        {/* Promo Code & Cost Card */}
        <div className="bg-white border border-gray-200 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl w-full">
          {/* Promo Code */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Promo Code (optional)</label>
            <input
              type="text"
              placeholder="Promo code"
              className="bg-gray-50 border border-gray-300 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Cost Summary */}
          <div className="bg-gray-50 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 flex flex-col gap-1 sm:gap-1.5">
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs sm:text-sm">Deployment Cost:</span>
              <span className="text-gray-600 text-xs sm:text-sm text-right">{deploymentCost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs sm:text-sm">Estimated Gas Fee:</span>
              <span className="text-gray-600 text-xs sm:text-sm text-right">0.000004 ETH ($0.01)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3 text-amber-700 text-xs sm:text-sm animate-fade-in flex items-center gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Connect your wallet to deploy this token</span>
        </div>
      )}

      {/* Error Message */}
      {deployError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 text-red-600 text-xs sm:text-sm animate-fade-in">
          {deployError}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-50 border border-gray-300 text-black h-9 sm:h-10 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-100 transition-colors cursor-pointer flex-1"
        >
          Back
        </button>
        {isConnected ? (
          <button
            type="button"
            onClick={onDeploy}
            className="flex-1 bg-black text-white h-9 sm:h-10 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Deploy Token
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnectWallet}
            className="flex-1 bg-black text-white h-9 sm:h-10 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}

// ===== CREATE TOKEN PAGE =====
export function CreateTokenPage() {
  const navigate = useNavigate();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const {
    form,
    tokenType,
    setTokenType,
    step,
    goToNextStep,
    goToPreviousStep,
    deployingStep,
    deploymentResult,
    deployError,
    startDeployment,
    isSwitchingChain,
    hasResumableDeployment,
    resumeDeployment,
    cancelResumableDeployment,
  } = useCreateToken();

  const handleViewToken = () => {
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleConnectWallet = () => {
    open();
  };

  const formData = form.watch();

  return (
    <>
      <div className="flex-1 flex flex-col items-center py-8 sm:py-16 px-2 sm:px-4">
        {step === 'choose-type' && (
          <ChooseTokenType
            selectedType={tokenType}
            onSelectType={setTokenType}
            onContinue={goToNextStep}
            onCancel={handleCancel}
            hasResumableDeployment={hasResumableDeployment}
            onResume={resumeDeployment}
            onCancelResume={cancelResumableDeployment}
          />
        )}

        {step === 'token-info' && (
          <TokenInformation
            form={form}
            onBack={goToPreviousStep}
            onContinue={goToNextStep}
          />
        )}

        {(step === 'review' || step === 'deploying' || step === 'success') && (
          <Review
            form={form}
            tokenType={tokenType}
            onBack={goToPreviousStep}
            onDeploy={startDeployment}
            deployError={deployError}
            isConnected={isConnected}
            onConnectWallet={handleConnectWallet}
          />
        )}
      </div>

      {/* Deploying Modal */}
      {step === 'deploying' && (
        <DeployingModal 
          tokenType={tokenType} 
          currentStep={deployingStep} 
          isSwitchingChain={isSwitchingChain}
        />
      )}

      {/* Success Modal */}
      {step === 'success' && (
        <SuccessModal 
          formData={{ ...formData, initialSupply: formData.initialSupply, maxSupply: formData.maxSupply }} 
          tokenType={tokenType}
          deploymentResult={deploymentResult}
          onOpenDashboard={handleViewToken} 
        />
      )}
    </>
  );
}
