import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { truncateAddress } from '@/lib/utils'

// Single mainnet client for all ENS lookups
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
})

// Module-level caches so lookups only happen once per address per session
const nameCache = new Map<string, string | null>()
const avatarCache = new Map<string, string | null>()

async function resolveENS(address: string): Promise<{ name: string | null; avatar: string | null }> {
  const key = address.toLowerCase()

  if (!nameCache.has(key)) {
    try {
      const name = await ensClient.getEnsName({ address: address as `0x${string}` })
      nameCache.set(key, name ?? null)
    } catch {
      nameCache.set(key, null)
    }
  }

  const name = nameCache.get(key) ?? null

  if (name && !avatarCache.has(key)) {
    try {
      const avatar = await ensClient.getEnsAvatar({ name })
      avatarCache.set(key, avatar ?? null)
    } catch {
      avatarCache.set(key, null)
    }
  } else if (!name) {
    avatarCache.set(key, null)
  }

  return { name, avatar: avatarCache.get(key) ?? null }
}

interface ENSAddressProps {
  address: string
  className?: string
}

export function ENSAddress({ address, className }: ENSAddressProps) {
  const [ensName, setEnsName] = useState<string | null>(() => nameCache.get(address.toLowerCase()) ?? null)
  const [ensAvatar, setEnsAvatar] = useState<string | null>(() => avatarCache.get(address.toLowerCase()) ?? null)
  const [avatarError, setAvatarError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const key = address.toLowerCase()

    // Already fully resolved (both checked)
    if (nameCache.has(key) && avatarCache.has(key)) {
      setEnsName(nameCache.get(key) ?? null)
      setEnsAvatar(avatarCache.get(key) ?? null)
      return
    }

    resolveENS(address).then(({ name, avatar }) => {
      if (cancelled) return
      setEnsName(name)
      setEnsAvatar(avatar)
      setAvatarError(false)
    })

    return () => { cancelled = true }
  }, [address])

  const display = ensName ?? truncateAddress(address)
  const showAvatar = ensAvatar && !avatarError

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={address}>
      {showAvatar && (
        <img
          src={ensAvatar}
          alt={ensName ?? address}
          className="w-4 h-4 rounded-full shrink-0"
          onError={() => setAvatarError(true)}
        />
      )}
      <span className={ensName ? '' : 'font-mono text-sm'}>
        {display}
      </span>
    </span>
  )
}
