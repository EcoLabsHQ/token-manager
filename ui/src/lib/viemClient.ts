import { createPublicClient, http } from 'viem';
import { celo, mainnet } from 'viem/chains';
import { publicActionsL1, publicActionsL2 } from 'viem/op-stack';
import { celoOpStack } from '@/config/chains';

// Default wagmi-compatible client (kept for backward compat)
export const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

/**
 * Dedicated archive-capable L2 (Celo) public client.
 * Uses Forno, which is an archive node and supports eth_getProof.
 * Do NOT replace with the wagmi publicClient—WalletConnect's RPC proxy
 * does not serve archived trie nodes required by buildProveWithdrawal.
 */
export const archivePublicClientL2 = createPublicClient({
  chain: celoOpStack as typeof celo,
  transport: http(
    import.meta.env.VITE_CELO_RPC_URL || 'https://forno.celo.org',
  ),
}).extend(publicActionsL2());

/**
 * Dedicated L1 (Ethereum Mainnet) public client for proof / status reads.
 * Uses a public RPC that supports eth_getProof (publicnode).
 */
export const archivePublicClientL1 = createPublicClient({
  chain: mainnet,
  transport: http(
    import.meta.env.VITE_ETH_RPC_URL ||
      'https://ethereum-rpc.publicnode.com',
  ),
}).extend(publicActionsL1());
