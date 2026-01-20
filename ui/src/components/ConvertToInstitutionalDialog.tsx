import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConvertToInstitutional } from '@/hooks/useConvertToInstitutional';
import { useReadContract, useAccount } from 'wagmi';
import { getAddress } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import { CheckCircle2, Circle, Loader2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface ConvertToInstitutionalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (l1Address: string, l2Address: string) => void;
}

const ERC20_MINIMAL_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'remoteToken',
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function ConvertToInstitutionalDialog({
  open,
  onOpenChange,
  onSuccess,
}: ConvertToInstitutionalDialogProps) {
  const [l2Address, setL2Address] = useState('');
  const [initialSupply, setInitialSupply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { address: walletAddress } = useAccount();
  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const {
    convertToInstitutional,
    isLoading,
    error,
    l1TokenAddress,
    currentStep,
  } = useConvertToInstitutional();

  const { data: tokenName } = useReadContract({
    address: isValidAddress(l2Address) ? getAddress(l2Address) : undefined,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'name',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    query: { enabled: isValidAddress(l2Address) },
  } as any);

  const { data: tokenSymbol } = useReadContract({
    address: isValidAddress(l2Address) ? getAddress(l2Address) : undefined,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'symbol',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    query: { enabled: isValidAddress(l2Address) },
  } as any);

  const { data: remoteToken } = useReadContract({
    address: isValidAddress(l2Address) ? getAddress(l2Address) : undefined,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'remoteToken',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    query: { enabled: isValidAddress(l2Address) },
  } as any);

  const { data: tokenOwner } = useReadContract({
    address: isValidAddress(l2Address) ? getAddress(l2Address) : undefined,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'owner',
    chainId: CONTRACTS.L2_SUPERCHAIN_TOKEN_FACTORY.chainId,
    query: { enabled: isValidAddress(l2Address) },
  } as any);

  const hasRemoteToken = Boolean(remoteToken && remoteToken !== '0x0000000000000000000000000000000000000000');
  const tokenNameStr = tokenName ? String(tokenName) : null;
  const tokenOwnerStr = tokenOwner ? String(tokenOwner) : null;
  const isOwner = Boolean(walletAddress && tokenOwnerStr && 
    walletAddress.toLowerCase() === tokenOwnerStr.toLowerCase());

  useEffect(() => {
    if (open) {
      setL2Address('');
      setInitialSupply('');
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (currentStep === 'success' && l1TokenAddress && l2Address) {
      onSuccess?.(l1TokenAddress, l2Address);
      setTimeout(() => onOpenChange(false), 2500);
    }
  }, [currentStep, l1TokenAddress, l2Address, onSuccess, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress(l2Address) || !initialSupply || !tokenNameStr || !tokenSymbol) return;
    setIsSubmitting(true);
    await convertToInstitutional({
      l2TokenAddress: l2Address,
      name: tokenNameStr,
      symbol: String(tokenSymbol),
      initialSupply,
    });
  };

  const steps = [
    { key: 'creating_l1', label: 'Deploying L1 Token', description: 'Creating token on Sepolia' },
    { key: 'configuring_bridge', label: 'Configuring Bridge', description: 'Linking L1 ↔ L2' },
    { key: 'success', label: 'Complete', description: 'Conversion finished' },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepOrder = ['creating_l1', 'configuring_bridge', 'success'];
    const currentIdx = stepOrder.indexOf(currentStep);
    const stepIdx = stepOrder.indexOf(stepKey);
    if (currentStep === 'error') return 'error';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-700 text-white">
        <DialogHeader className="border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Convert to Institutional</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Deploy L1 token and configure bridge
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSubmitting && currentStep !== 'idle' ? (
          <div className="py-6 space-y-4">
            {steps.map((step) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-400" />
                    ) : status === 'active' ? (
                      <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                    ) : status === 'error' ? (
                      <AlertCircle className="h-6 w-6 text-red-400" />
                    ) : (
                      <Circle className="h-6 w-6 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      status === 'completed' ? 'text-green-400' :
                      status === 'active' ? 'text-amber-400' :
                      status === 'error' ? 'text-red-400' :
                      'text-slate-500'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
              );
            })}

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {currentStep === 'success' && l1TokenAddress && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-medium mb-2">Conversion Complete!</p>
                <p className="text-xs text-slate-400">L1 Token:</p>
                <p className="font-mono text-xs text-green-300 break-all">{l1TokenAddress}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="l2Address" className="text-slate-300 text-sm">
                L2 Token Address
              </Label>
              <Input
                id="l2Address"
                type="text"
                placeholder="0x..."
                value={l2Address}
                onChange={(e) => setL2Address(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white font-mono text-sm placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
              {l2Address && !isValidAddress(l2Address) && (
                <p className="text-xs text-red-400">Invalid address format</p>
              )}
            </div>

            {isValidAddress(l2Address) && (
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Token Info</span>
                  {hasRemoteToken ? (
                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                      Already Bridged
                    </span>
                  ) : !isOwner && tokenOwner ? (
                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                      Not Owner
                    </span>
                  ) : tokenNameStr ? (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                      Eligible
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="text-sm text-white">{tokenNameStr || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Symbol</p>
                    <p className="text-sm text-white">{String(tokenSymbol || '—')}</p>
                  </div>
                </div>
                {tokenOwnerStr && (
                  <div>
                    <p className="text-xs text-slate-500">Owner</p>
                    <p className={`text-xs font-mono ${isOwner ? 'text-green-400' : 'text-red-400'}`}>
                      {tokenOwnerStr.slice(0, 10)}...{tokenOwnerStr.slice(-8)}
                      {isOwner && <span className="ml-2 text-green-400">(You)</span>}
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasRemoteToken && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  This token already has a bridge configured.
                </p>
              </div>
            )}

            {!isOwner && tokenOwnerStr && !hasRemoteToken && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  You are not the owner of this token. Only the owner can configure the bridge.
                </p>
              </div>
            )}

            {isValidAddress(l2Address) && !hasRemoteToken && tokenNameStr && isOwner && (
              <div className="space-y-2">
                <Label htmlFor="initialSupply" className="text-slate-300 text-sm">
                  L1 Initial Supply
                </Label>
                <Input
                  id="initialSupply"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1000000"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                  required
                />
                <p className="text-xs text-slate-500">
                  Tokens to mint on L1 for bridging operations
                </p>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-slate-700 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValidAddress(l2Address) || !initialSupply || hasRemoteToken || isLoading || !tokenNameStr || !isOwner}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Convert Token'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
