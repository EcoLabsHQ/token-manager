import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WalletProvider } from './context/WalletContext';
import { AppKitProvider } from '@reown/appkit/react';
import { createAppKit } from '@reown/appkit/react';

import { WagmiProvider } from 'wagmi';
import { mainnet, arbitrum, optimism, base, sepolia, celo } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from https://cloud.reown.com
const projectId = '62c810723ad1406ccdb5a36768a29b3b';

// 2. Create a metadata object
const metadata = {
  name: 'High Velocity Token Manager',
  description: 'Manage High Velocity Tokens with Reown',
  url:
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://example.com',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// 3. Set the networks
const networks = [mainnet, arbitrum, optimism, base, sepolia, celo];

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks: networks as any,
  projectId,
  ssr: true,
});

// 5. Create modal - IMPORTANT: Must be before React rendering
createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  projectId,
  metadata,
  features: {
    analytics: true,
  },
});

createRoot(document.getElementById('root')!).render(
  <AppKitProvider networks={networks as any} projectId={projectId}>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <App />
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </AppKitProvider>
);
