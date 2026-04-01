import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { Shield, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { useL1OnlyTokenDeploy } from '@/hooks/useL1OnlyTokenDeploy';
import { usePromoCode } from '@/hooks/usePromoCode';
import { CONTRACTS } from '@/config/contracts';
import { tokenFormSchema, defaultTokenFormValues, type TokenFormData } from '@/lib/schemas';
import { formatNumberWithCommas, parseFormattedNumber, formatDisplayNumber } from '@/lib/utils';
import { CheckIcon, ClockIcon } from '@/components/Icons';

const ETHEREUM_EXPLORER = 'https://etherscan.io';

function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ===== Deploying Modal (L1 only — single step) =====
function L1DeployingModal({ step, isSwitchingChain }: { step: string; isSwitchingChain: boolean }) {
  const steps = [
    { title: 'Uploading metadata', description: 'Pinning image & metadata to IPFS', key: 'uploading' },
    { title: 'Creating L1 Token', description: 'Deploying token on Ethereum Mainnet', key: 'creating' },
  ];

  const getStatus = (key: string) => {
    const order = ['uploading', 'creating', 'success'];
    const currentIdx = order.indexOf(step);
    const stepIdx = order.indexOf(key);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-[456px] overflow-hidden shadow-xl">
        <div className="border-b border-gray-200 p-5">
          <h2 className="font-semibold text-lg text-black tracking-[-0.25px]">
            Deploying L1-Only Token
          </h2>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">
              {isSwitchingChain ? 'Switching network...' : 'Deploying'}
            </span>
            <div className="flex items-center gap-1.5 text-gray-500">
              <ClockIcon className="w-4 h-4" />
              <span className="text-sm">~2 min</span>
            </div>
          </div>

          <div className="flex flex-col">
            {steps.map((s, index) => {
              const status = getStatus(s.key);
              const isCompleted = status === 'completed';
              const isActive = status === 'active';
              return (
                <div key={s.key}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-50' : 'bg-gray-100'
                      }`}>
                        {isCompleted && <CheckIcon className="w-5 h-5 text-white" />}
                        {isActive && (
                          <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3B82F6" strokeWidth="3" />
                            <path className="opacity-100" fill="#3B82F6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded border-2 border-white overflow-hidden">
                        <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <p className={`font-medium text-base ${isCompleted || isActive ? 'text-black' : 'text-gray-400'}`}>
                        {s.title}
                      </p>
                      <p className={`text-sm ${isCompleted || isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                        {s.description}
                      </p>
                    </div>
                  </div>
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

// ===== Success Modal (L1 only) =====
function L1SuccessModal({
  tokenAddress,
  tokenName,
  tokenSymbol,
  onReset,
}: {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-[456px] overflow-hidden shadow-xl">
        <div className="p-5 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-black tracking-[-0.25px]">
            Deployment Successful
          </h2>
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-blue-600">{tokenName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-black">{tokenName}</p>
              <p className="text-sm text-gray-500">{tokenSymbol}</p>
            </div>
          </div>

          <p className="text-gray-500 text-sm leading-5">
            Your token has been successfully deployed on Ethereum (L1) with the initial supply minted to your wallet.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-sm text-black">L1 Token Address</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded overflow-hidden shrink-0">
                <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm text-black font-mono truncate">{truncateAddress(tokenAddress)}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer shrink-0"
                title="Copy address"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
              <button
                onClick={() => window.open(`${ETHEREUM_EXPLORER}/address/${tokenAddress}`, '_blank')}
                className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer shrink-0"
                title="View on Etherscan"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <button
            onClick={onReset}
            className="w-full bg-black text-white h-11 rounded-lg font-medium text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Deploy Another Token
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Main Internal Page =====
export default function InternalPage() {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const {
    deploy,
    reset,
    currentStep,
    error: deployError,
    tokenAddress,
    creationFee,
    isSwitchingChain,
    isLoading,
  } = useL1OnlyTokenDeploy();

  const promo = usePromoCode(CONTRACTS.L1_TOKEN_FACTORY.chainId);

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: defaultTokenFormValues,
    mode: 'onChange',
  });

  const { register, formState: { errors, isValid }, watch, setValue, control } = form;
  const formData = watch();
  const decimals = watch('decimals');

  const formatFee = (fee: bigint, symbol: string) => {
    const formatted = Number(fee) / 1e18;
    return `${formatted.toFixed(4)} ${symbol}`;
  };

  const displayFee = formatFee(creationFee, 'ETH');
  const finalFee = promo.promoStatus === 'valid' && promo.checkResult
    ? `${(Number(promo.checkResult.discountFee) / 1e18).toFixed(4)} ETH`
    : displayFee;

  const handleDeploy = async () => {
    const valid = await form.trigger();
    if (!valid) return;

    let promoData = null;
    if (promo.promoCode && address) {
      promoData = await promo.validatePromoCode(promo.promoCode, address, true);
    }

    deploy(
      {
        name: formData.name,
        symbol: formData.symbol,
        initialSupply: formData.initialSupply,
        maxSupply: formData.maxSupply,
        decimals: formData.decimals,
        tokenLogo: formData.tokenLogo,
      },
      promoData,
    );
  };

  const handleReset = () => {
    reset();
    form.reset(defaultTokenFormValues);
    promo.clearPromo();
  };

  const isDeploying = currentStep === 'uploading' || currentStep === 'creating';

  return (
    <>
      <div className="flex-1 flex flex-col items-center py-16 px-4">
        <div className="flex flex-col gap-6 w-full max-w-[456px]">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-blue-500" />
            <div>
              <h1 className="text-2xl font-semibold text-black tracking-[-0.25px]">L1-Only Token Deploy</h1>
              <p className="text-gray-500 text-sm">Create a token on Ethereum Mainnet only — no bridge to Celo.</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white border border-gray-200 flex flex-col gap-4 p-4 rounded-2xl w-full">
            {/* Token Name */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-sm">Token Name</label>
              <input
                type="text"
                placeholder="e.g., My Token"
                {...register('name')}
                className={`bg-gray-50 border rounded-md px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <span className="text-red-500 text-xs">{errors.name.message}</span>}
            </div>

            {/* Token Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-sm">Token Symbol</label>
              <input
                type="text"
                placeholder="e.g., MTK"
                {...register('symbol', {
                  onChange: (e) => {
                    const upperValue = e.target.value.toUpperCase();
                    e.target.value = upperValue;
                    setValue('symbol', upperValue);
                  },
                })}
                className={`bg-gray-50 border rounded-md px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.symbol ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.symbol && <span className="text-red-500 text-xs">{errors.symbol.message}</span>}
            </div>

            {/* Initial Supply & Max Supply */}
            <div className="flex flex-row gap-2">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-gray-500 text-sm">Initial Supply</label>
                <Controller
                  name="initialSupply"
                  control={control}
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
                      className={`w-full bg-gray-50 border rounded-md px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.initialSupply ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  )}
                />
                {errors.initialSupply && <span className="text-red-500 text-xs">{errors.initialSupply.message}</span>}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-gray-500 text-sm">Max Supply</label>
                <Controller
                  name="maxSupply"
                  control={control}
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
                      className={`w-full bg-gray-50 border rounded-md px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.maxSupply ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  )}
                />
                {errors.maxSupply && <span className="text-red-500 text-xs">{errors.maxSupply.message}</span>}
              </div>
            </div>

            {/* Decimals */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-sm">Decimals</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={decimals}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-black bg-white"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setValue('decimals', Math.max(decimals - 1, 0))}
                    className={`bg-gray-50 border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center hover:bg-gray-100 ${
                      decimals <= 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    disabled={decimals <= 0}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('decimals', Math.min(decimals + 1, 18))}
                    className="bg-gray-50 border border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center hover:bg-gray-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Token Logo */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-sm">Token Logo</label>
              <Controller
                name="tokenLogo"
                control={control}
                render={({ field }) => (
                  <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                    {field.value ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                          <img src={field.value} alt="Token Logo" className="w-full h-full object-contain" />
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
                                if (file.size > 500 * 1024) { alert('Image must be less than 500KB'); return; }
                                const reader = new FileReader();
                                reader.onloadend = () => field.onChange(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-black transition-colors cursor-pointer"
                        >
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
                              if (file.size > 500 * 1024) { alert('Image must be less than 500KB'); return; }
                              const reader = new FileReader();
                              reader.onloadend = () => field.onChange(reader.result as string);
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
                        <span className="text-sm text-gray-500">Click to upload logo</span>
                        <span className="text-xs text-gray-400">PNG, JPG, SVG or WebP (max 500KB)</span>
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          </div>

          {/* Promo Code & Cost */}
          <div className="bg-white border border-gray-200 flex flex-col gap-4 p-4 rounded-2xl w-full">
            <div className="flex flex-col gap-1">
              <label className="text-gray-500 text-sm">Promo Code (optional)</label>
              <p className="text-blue-600 text-xs font-medium">
                💡 Use code <span className="font-bold">L2</span> to get 100% off
              </p>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter promo code"
                  value={promo.promoCode}
                  onChange={(e) => promo.setPromoCode(e.target.value)}
                  className={`w-full bg-gray-50 border rounded-md px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    promo.promoStatus === 'invalid' || promo.promoStatus === 'error'
                      ? 'border-red-300'
                      : promo.promoStatus === 'valid'
                        ? 'border-green-300'
                        : 'border-gray-300'
                  }`}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {promo.promoStatus === 'checking' && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                  {promo.promoStatus === 'valid' && <Check className="h-4 w-4 text-green-500" />}
                  {(promo.promoStatus === 'invalid' || promo.promoStatus === 'error') && promo.promoCode && (
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              </div>
              {promo.promoError && <span className="text-red-500 text-xs">{promo.promoError}</span>}
              {promo.promoStatus === 'valid' && promo.checkResult && (
                <span className="text-green-600 text-xs">
                  ✓ Valid! Fee: {(Number(promo.checkResult.discountFee) / 1e18).toFixed(4)} ETH
                </span>
              )}
            </div>

            <div className="bg-gray-50 rounded-md px-3 py-2 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Creation Fee:</span>
                <span className={`text-sm text-right ${promo.promoStatus === 'valid' ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  {promo.promoStatus === 'valid' ? '✓ ' : ''}{finalFee}
                </span>
              </div>
              {promo.promoStatus === 'valid' && promo.checkResult && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm line-through">Original Fee:</span>
                  <span className="text-gray-400 text-sm text-right line-through">{displayFee}</span>
                </div>
              )}
            </div>
          </div>

          {/* Review summary */}
          {isValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-2">
              <h3 className="font-medium text-blue-900 text-sm">Deploy Summary</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-blue-700">Name:</span>
                <span className="text-blue-900 font-medium">{formData.name}</span>
                <span className="text-blue-700">Symbol:</span>
                <span className="text-blue-900 font-medium">{formData.symbol}</span>
                <span className="text-blue-700">Initial Supply:</span>
                <span className="text-blue-900 font-medium">{formatDisplayNumber(formData.initialSupply)}</span>
                <span className="text-blue-700">Max Supply:</span>
                <span className="text-blue-900 font-medium">{formatDisplayNumber(formData.maxSupply)}</span>
                <span className="text-blue-700">Decimals:</span>
                <span className="text-blue-900 font-medium">{formData.decimals}</span>
                <span className="text-blue-700">Chain:</span>
                <span className="text-blue-900 font-medium flex items-center gap-1">
                  <img src="/images/ethereum.png" alt="ETH" className="w-4 h-4 rounded" /> Ethereum L1
                </span>
              </div>
            </div>
          )}

          {/* Wallet / error states */}
          {!isConnected && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Connect your wallet to deploy this token</span>
            </div>
          )}

          {deployError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
              {deployError}
            </div>
          )}

          {/* Action Button */}
          {isConnected ? (
            <button
              type="button"
              onClick={handleDeploy}
              disabled={!isValid || isLoading || promo.isChecking}
              className="w-full bg-black text-white h-11 rounded-lg font-medium text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deploying...
                </>
              ) : promo.isChecking ? (
                'Checking promo...'
              ) : (
                <>
                  <img src="/images/ethereum.png" alt="ETH" className="w-4 h-4 rounded" />
                  Deploy on Ethereum L1
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => open()}
              className="w-full bg-black text-white h-11 rounded-lg font-medium text-sm tracking-[0.25px] hover:bg-gray-900 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Deploying Modal */}
      {isDeploying && (
        <L1DeployingModal step={currentStep} isSwitchingChain={isSwitchingChain} />
      )}

      {/* Success Modal */}
      {currentStep === 'success' && tokenAddress && (
        <L1SuccessModal
          tokenAddress={tokenAddress}
          tokenName={formData.name}
          tokenSymbol={formData.symbol}
          onReset={handleReset}
        />
      )}
    </>
  );
}
