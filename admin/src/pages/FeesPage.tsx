import { useState, useCallback } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { parseEther, formatEther, isAddress } from 'viem'
import { mainnet, celo } from 'viem/chains'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, Copy, Check, Loader2, Settings2, Wallet } from 'lucide-react'

function CopyableBadge({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [value])
  return (
    <button
      onClick={handleCopy}
      title={value}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono border-gray-300 bg-white hover:bg-gray-50 transition-colors"
    >
      <span>{value.slice(0, 6)}…{value.slice(-4)}</span>
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3 text-gray-400" />}
    </button>
  )
}
import { SUPPORTED_CHAINS } from '@/lib/api'

// -----------------------------------------------------------------------
// Minimal ABI — only the functions we need for fee management
// -----------------------------------------------------------------------
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creationFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'promoSigner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setCreationFee',
    inputs: [{ name: '_fee', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeeRecipient',
    inputs: [{ name: '_recipient', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPromoSigner',
    inputs: [{ name: '_signer', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// -----------------------------------------------------------------------
// Chain panel — one per factory contract
// -----------------------------------------------------------------------
interface ChainFeesPanelProps {
  chainId: number
  contractAddress: `0x${string}`
  chainName: string
  nativeSymbol: string
  connectedAddress: string | undefined
  connectedChainId: number | undefined
}

function ChainFeesPanel({
  chainId,
  contractAddress,
  chainName,
  nativeSymbol,
  connectedAddress,
  connectedChainId,
}: ChainFeesPanelProps) {
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Form state
  const [feeInput, setFeeInput] = useState('')
  const [recipientInput, setRecipientInput] = useState('')
  const [promoSignerInput, setPromoSignerInput] = useState('')
  const [activeAction, setActiveAction] = useState<'fee' | 'recipient' | 'signer' | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // ---- Contract reads ----
  const {
    data: owner,
    isLoading: loadingOwner,
    isError: ownerError,
    refetch: refetchOwner,
  } = useReadContract({
    address: contractAddress,
    abi: FACTORY_ABI,
    functionName: 'owner',
    chainId,
  })

  const { data: creationFee, isLoading: loadingFee, refetch: refetchFee } = useReadContract({
    address: contractAddress,
    abi: FACTORY_ABI,
    functionName: 'creationFee',
    chainId,
  })

  const { data: feeRecipient, isLoading: loadingRecipient, refetch: refetchRecipient } = useReadContract({
    address: contractAddress,
    abi: FACTORY_ABI,
    functionName: 'feeRecipient',
    chainId,
  })

  const { data: promoSignerAddress, isLoading: loadingPromoSigner, refetch: refetchPromoSigner } = useReadContract({
    address: contractAddress,
    abi: FACTORY_ABI,
    functionName: 'promoSigner',
    chainId,
  })

  const ownerAddress = owner as string | undefined

  // Only consider isOwner when the read has settled and we have both values
  const ownerKnown = !loadingOwner && !ownerError && !!ownerAddress
  const isOwner =
    ownerKnown &&
    !!connectedAddress &&
    connectedAddress.toLowerCase() === ownerAddress!.toLowerCase()

  const isOnCorrectChain = connectedChainId === chainId

  const handleRefreshAll = () => {
    refetchOwner()
    refetchFee()
    refetchRecipient()
    refetchPromoSigner()
    resetWrite()
    setActiveAction(null)
    setLocalError(null)
  }

  const requiresChainSwitch = !isOnCorrectChain && !!connectedAddress

  // ---- Write helpers ----
  const submitSetFee = () => {
    setLocalError(null)
    if (!feeInput) return
    let feeBigInt: bigint
    try {
      feeBigInt = parseEther(feeInput)
    } catch {
      setLocalError('Invalid fee amount')
      return
    }
    setActiveAction('fee')
    writeContract(
      {
        address: contractAddress,
        abi: FACTORY_ABI,
        functionName: 'setCreationFee',
        args: [feeBigInt],
        chainId,
      },
      {
        onError: (e) => setLocalError(e.message),
        onSuccess: () => {
          setFeeInput('')
          setTimeout(handleRefreshAll, 3000)
        },
      },
    )
  }

  const submitSetRecipient = () => {
    setLocalError(null)
    if (!recipientInput || !isAddress(recipientInput)) {
      setLocalError('Invalid address for fee recipient')
      return
    }
    setActiveAction('recipient')
    writeContract(
      {
        address: contractAddress,
        abi: FACTORY_ABI,
        functionName: 'setFeeRecipient',
        args: [recipientInput as `0x${string}`],
        chainId,
      },
      {
        onError: (e) => setLocalError(e.message),
        onSuccess: () => {
          setRecipientInput('')
          setTimeout(handleRefreshAll, 3000)
        },
      },
    )
  }

  const submitSetPromoSigner = () => {
    setLocalError(null)
    if (!promoSignerInput || !isAddress(promoSignerInput)) {
      setLocalError('Invalid address for promo signer')
      return
    }
    setActiveAction('signer')
    writeContract(
      {
        address: contractAddress,
        abi: FACTORY_ABI,
        functionName: 'setPromoSigner',
        args: [promoSignerInput as `0x${string}`],
        chainId,
      },
      {
        onError: (e) => setLocalError(e.message),
        onSuccess: () => {
          setPromoSignerInput('')
          setTimeout(handleRefreshAll, 3000)
        },
      },
    )
  }

  const isBusy = isWriting || isConfirming

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gray-50/60 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            {chainName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <CopyableBadge value={contractAddress} />
            {loadingOwner && connectedAddress ? (
              <Badge variant="outline" className="text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Verifying…
              </Badge>
            ) : ownerError ? (
              <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                Read error
              </Badge>
            ) : isOwner ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">Owner ✓</Badge>
            ) : ownerKnown && connectedAddress ? (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                Not Owner
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Current values */}
        <div className="grid grid-cols-1 gap-3">
          <InfoRow
            label="Contract Owner"
            value={ownerError ? '⚠ Could not read' : ownerAddress}
            loading={loadingOwner}
            mono
          />
          <InfoRow
            label={`Creation Fee (${nativeSymbol})`}
            value={creationFee !== undefined ? formatEther(creationFee as bigint) : undefined}
            loading={loadingFee}
          />
          <InfoRow
            label="Fee Recipient"
            value={feeRecipient as string | undefined}
            loading={loadingRecipient}
            mono
          />
          <InfoRow
            label="Promo Signer"
            value={promoSignerAddress as string | undefined}
            loading={loadingPromoSigner}
            mono
          />
        </div>

        {/* Status messages */}
        {txHash && isConfirmed && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Transaction confirmed — values updated.
          </div>
        )}
        {localError && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{localError}</span>
          </div>
        )}

        {/* Chain-switch prompt */}
        {requiresChainSwitch && isOwner && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-sm text-amber-800">
              Switch to <strong>{chainName}</strong> to send transactions.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 shrink-0"
              onClick={() => switchChain({ chainId })}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Switch
            </Button>
          </div>
        )}

        {/* Edit forms — only shown when owner and on correct chain */}
        {isOwner && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Update Settings
            </p>

            {/* Set creation fee */}
            <div className="space-y-1.5">
              <Label htmlFor={`fee-${chainId}`}>
                New Creation Fee ({nativeSymbol})
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`fee-${chainId}`}
                  placeholder="e.g. 0.001"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  disabled={isBusy || requiresChainSwitch}
                />
                <Button
                  size="sm"
                  onClick={submitSetFee}
                  disabled={isBusy || requiresChainSwitch || !feeInput}
                >
                  {isBusy && activeAction === 'fee' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
            </div>

            {/* Set fee recipient */}
            <div className="space-y-1.5">
              <Label htmlFor={`recipient-${chainId}`}>New Fee Recipient</Label>
              <div className="flex gap-2">
                <Input
                  id={`recipient-${chainId}`}
                  placeholder="0x..."
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  disabled={isBusy || requiresChainSwitch}
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={submitSetRecipient}
                  disabled={isBusy || requiresChainSwitch || !recipientInput}
                >
                  {isBusy && activeAction === 'recipient' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
            </div>

            {/* Set promo signer */}
            <div className="space-y-1.5">
              <Label htmlFor={`signer-${chainId}`}>New Promo Signer</Label>
              <div className="flex gap-2">
                <Input
                  id={`signer-${chainId}`}
                  placeholder="0x..."
                  value={promoSignerInput}
                  onChange={(e) => setPromoSignerInput(e.target.value)}
                  disabled={isBusy || requiresChainSwitch}
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={submitSetPromoSigner}
                  disabled={isBusy || requiresChainSwitch || !promoSignerInput}
                >
                  {isBusy && activeAction === 'signer' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Not owner but connected */}
        {!isOwner && connectedAddress && ownerKnown && (
          <p className="text-sm text-gray-400 border-t pt-3">
            Connect with the owner wallet ({ownerAddress?.slice(0, 6)}…
            {ownerAddress?.slice(-4)}) to edit these settings.
          </p>
        )}
        {!isOwner && connectedAddress && !ownerKnown && !loadingOwner && (
          <p className="text-sm text-red-400 border-t pt-3">
            Could not read the contract owner — check the RPC or contract address.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------
// Small helper to display a labelled value row
// -----------------------------------------------------------------------
function InfoRow({
  label,
  value,
  loading,
  mono = false,
}: {
  label: string
  value: string | undefined
  loading: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-36" />
      ) : (
        <span
          className={`text-gray-800 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}
        >
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------
export function FeesPage() {
  const { address: connectedAddress, isConnected, chainId: connectedChainId } = useAccount()
  const { open } = useAppKit()

  const chains: Array<{
    chainId: number
    chainName: string
    nativeSymbol: string
    contractAddress: `0x${string}`
  }> = Object.entries(SUPPORTED_CHAINS).map(([id, cfg]) => ({
    chainId: Number(id),
    chainName: cfg.name,
    nativeSymbol: cfg.symbol,
    contractAddress: cfg.address,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fee Management</h2>
          <p className="text-gray-500 mt-1">
            View and update creation fees, fee recipients and promo signers for each factory
            contract. You must be connected with the contract owner wallet to make changes.
          </p>
        </div>
        {!isConnected && (
          <Button onClick={() => open()} className="shrink-0 flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        )}
      </div>

      {!isConnected && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Connect your wallet to interact with the contracts. Fee values are always visible
          regardless of connection status.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {chains.map((chain) => (
          <ChainFeesPanel
            key={chain.chainId}
            chainId={chain.chainId}
            contractAddress={chain.contractAddress}
            chainName={chain.chainName}
            nativeSymbol={chain.nativeSymbol}
            connectedAddress={connectedAddress}
            connectedChainId={connectedChainId}
          />
        ))}
      </div>
    </div>
  )
}

// Re-export chains so they can be used elsewhere if needed
export { mainnet, celo }
