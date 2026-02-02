import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { celoSepolia, sepolia } from 'wagmi/chains';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Get projectId from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'YOUR_PROJECT_ID';

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
  console.warn(
    'VITE_REOWN_PROJECT_ID not set. Please add your Reown project ID to .env.local',
  );
}

// Custom chain configurations with proper icons
const sepoliaWithIcon: AppKitNetwork = {
  ...sepolia,
  imageUrl: '/images/ethereum.png',
};

const celoSepoliaWithIcon: AppKitNetwork = {
  ...celoSepolia,
  imageUrl: '/images/celo.png',
};

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  chains: [sepolia, celoSepolia],
  projectId,
} as any);

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [sepoliaWithIcon, celoSepoliaWithIcon],
  defaultNetwork: sepoliaWithIcon,
  metadata: {
    name: 'High Velocity Token Manager',
    description: 'Manage your High Velocity Tokens with ease',
    url: 'https://github.com/kolektivo/minter',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
} as any);
