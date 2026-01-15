import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, arbitrum, optimism, base, sepolia } from 'wagmi/chains';

// Get projectId from environment variable
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'YOUR_PROJECT_ID';

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
  console.warn(
    'VITE_REOWN_PROJECT_ID not set. Please add your Reown project ID to .env.local'
  );
}

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  chains: [mainnet, arbitrum, optimism, base, sepolia],
  projectId,
} as any);

// Create AppKit instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum, optimism, base, sepolia],
  defaultNetwork: mainnet,
  metadata: {
    name: 'High Velocity Token Manager',
    description: 'Manage your High Velocity Tokens with ease',
    url: 'https://github.com/kolektivo/minter',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
  }
} as any);
