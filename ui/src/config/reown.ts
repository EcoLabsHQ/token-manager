import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { celo, mainnet } from 'wagmi/chains';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Get projectId from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'YOUR_PROJECT_ID';

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
  console.warn(
    'VITE_REOWN_PROJECT_ID not set. Please add your Reown project ID to .env.local',
  );
}

// Chain configurations
const ethereumMainnet: AppKitNetwork = {
  ...mainnet,
};

const celoMainnet: AppKitNetwork = {
  ...celo,
};

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  chains: [mainnet, celo],
  projectId,
} as any);

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [ethereumMainnet, celoMainnet],
  defaultNetwork: celoMainnet,
  metadata: {
    name: 'Kolektivo Token Minter',
    description: 'Create and manage your tokens on Ethereum and Celo',
    url: 'https://github.com/kolektivo/minter',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
} as any);
