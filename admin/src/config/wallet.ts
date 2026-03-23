import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, celo } from 'viem/chains';
import { http } from 'viem';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '';

if (!projectId) {
  console.warn(
    '⚠️ VITE_REOWN_PROJECT_ID is not set. Wallet connection may not work correctly.',
  );
}

export const networks = [mainnet, celo] as const;

// Explicit transports so contract reads work even without a Reown projectId
const transports = {
  [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
  [celo.id]: http('https://forno.celo.org'),
};

export const wagmiAdapter = new WagmiAdapter({
  networks: networks as any,
  chains: networks as any,
  transports,
  projectId,
  ssr: false,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  projectId,
  metadata: {
    name: 'Token Manager Admin',
    description: 'Admin panel for Token Manager',
    url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
  features: {
    analytics: false,
    socials: false, // Disable social logins for admin
    email: false,   // Disable email login for admin
  },
  // Featured wallets - Safe wallet ID for easy access
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // Safe
  ],
  // Allow all wallets that support WalletConnect
  allWallets: 'SHOW',
});

export { projectId };
