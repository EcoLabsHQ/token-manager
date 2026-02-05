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
                const upperValue = e.target.value.toUpperCase();
                e.target.value = upperValue;
                setValue('symbol', upperValue);
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
                onClick={() => setValue('decimals', Math.max(decimals - 1, 0))}
                className={`bg-gray-50 border border-gray-300 rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 text-sm sm:text-base ${decimals <= 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={decimals <= 0}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setValue('decimals', Math.min(decimals + 1, 18))}
                className="bg-gray-50 border border-gray-300 rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 cursor-pointer text-sm sm:text-base"
              >
                +
              </button>
            </div>
          </div>
          {errors.decimals && (
            <span className="text-red-500 text-[10px] sm:text-xs">{errors.decimals.message}</span>
          )}
        </div>

        {/* Token Logo */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-500 text-xs sm:text-sm">Token Logo</label>
          <Controller
            name="tokenLogo"
            control={form.control}
            render={({ field }) => (
              <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 sm:p-4">
                {field.value ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                      <img 
                        src={field.value} 
                        alt="Token Logo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            if (file.size > 500 * 1024) {
                              alert('Image must be less than 500KB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              field.onChange(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-black transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Replace
                    </button>
                  </div>
                ) : (
                  <div 
                    className="flex flex-col items-center gap-2 py-4 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          if (file.size > 500 * 1024) {
                            alert('Image must be less than 500KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            field.onChange(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">Click to upload logo</span>
                    <span className="text-[10px] sm:text-xs text-gray-400">PNG, JPG, SVG or WebP (max 500KB)</span>
                  </div>
                )}
              </div>
            )}
          />
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
  promoCode,
  onPromoCodeChange,
  promoError,
  promoStatus,
  isCheckingPromo,
  checkResult,
  l1CreationFee,
  l2CreationFee,
}: {
  form: UseFormReturn<TokenFormData>;
  tokenType: TokenType | null;
  onBack: () => void;
  onDeploy: () => void;
  deployError: string | null;
  isConnected: boolean;
  onConnectWallet: () => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  promoError: string | null;
  promoStatus: 'idle' | 'checking' | 'valid' | 'invalid' | 'error';
  isCheckingPromo: boolean;
  checkResult: { discountFee: string } | null;
  l1CreationFee: bigint;
  l2CreationFee: bigint;
}) {
  const { watch } = form;
  const formData = watch();
  
  // Format the creation fee for display
  const formatFee = (fee: bigint, symbol: string) => {
    const formatted = Number(fee) / 1e18;
    return `${formatted.toFixed(4)} ${symbol}`;
  };
  
  // Determine which fee to show based on token type
  const displayFee = tokenType === 'ethereum-enabled' 
    ? formatFee(l1CreationFee, 'ETH') + ' + ' + formatFee(l2CreationFee, 'CELO')
    : formatFee(l2CreationFee, 'CELO');
  
  // If promo is valid, show the discounted fee
  const finalFee = promoStatus === 'valid' && checkResult
    ? `${(Number(checkResult.discountFee) / 1e18).toFixed(4)} ${tokenType === 'ethereum-enabled' ? 'ETH' : 'CELO'}`
    : displayFee;

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

          {/* Token Logo */}
          {formData.tokenLogo && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-xs sm:text-sm">Token Logo</label>
              <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 flex justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                  <img 
                    src={formData.tokenLogo} 
                    alt="Token Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Promo Code & Cost Card */}
        <div className="bg-white border border-gray-200 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl w-full">
          {/* Promo Code */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-500 text-xs sm:text-sm">Promo Code (optional)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => onPromoCodeChange(e.target.value)}
                className={`w-full bg-gray-50 border rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 pr-10 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  promoStatus === 'invalid' || promoStatus === 'error' ? 'border-red-300' : 
                  promoStatus === 'valid' ? 'border-green-300' : 'border-gray-300'
                }`}
              />
              {/* Status Icon */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {promoStatus === 'checking' && (
                  <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {promoStatus === 'valid' && (
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {(promoStatus === 'invalid' || promoStatus === 'error') && promoCode && (
                  <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {promoError && (
              <span className="text-red-500 text-[10px] sm:text-xs">{promoError}</span>
            )}
            {promoStatus === 'valid' && checkResult && (
              <span className="text-green-600 text-[10px] sm:text-xs">
                ✓ Valid! Fee: {(Number(checkResult.discountFee) / 1e18).toFixed(4)} {tokenType === 'ethereum-enabled' ? 'ETH' : 'CELO'}
              </span>
            )}
          </div>

          {/* Cost Summary */}
          <div className="bg-gray-50 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 flex flex-col gap-1 sm:gap-1.5">
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs sm:text-sm">Creation Fee:</span>
              <span className={`text-xs sm:text-sm text-right ${promoStatus === 'valid' ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                {promoStatus === 'valid' ? '✓ ' : ''}{finalFee}
              </span>
            </div>
            {promoStatus === 'valid' && checkResult && (
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs sm:text-sm line-through">Original Fee:</span>
                <span className="text-gray-400 text-xs sm:text-sm text-right line-through">{displayFee}</span>
              </div>
            )}
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
            disabled={isCheckingPromo || (promoCode.length > 0 && promoStatus !== 'valid' && promoStatus !== 'idle')}
            className="flex-1 bg-black text-white h-9 sm:h-10 rounded-lg font-medium text-xs sm:text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCheckingPromo ? 'Checking promo...' : 'Deploy Token'}
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
  const { isConnected, address } = useAppKitAccount();
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
    promo,
    l1CreationFee,
    l2CreationFee,
  } = useCreateToken();

  const handleViewToken = () => {
    navigate('/', { state: { fromTokenCreation: true } });
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleConnectWallet = () => {
    open();
  };

  const handleDeploy = async () => {
    // If there's a promo code, validate it first
    if (promo.promoCode && address) {
      const isL1 = tokenType === 'ethereum-enabled';
      const promoResult = await promo.validatePromoCode(promo.promoCode, address, isL1);
      startDeployment(promoResult);
    } else {
      startDeployment(null);
    }
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
            onDeploy={handleDeploy}
            deployError={deployError}
            isConnected={isConnected}
            onConnectWallet={handleConnectWallet}
            promoCode={promo.promoCode}
            onPromoCodeChange={promo.setPromoCode}
            promoError={promo.promoError}
            promoStatus={promo.promoStatus}
            isCheckingPromo={promo.isChecking}
            checkResult={promo.checkResult}
            l1CreationFee={l1CreationFee}
            l2CreationFee={l2CreationFee}
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
