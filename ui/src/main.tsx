import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WalletProvider } from './context/WalletContext';
import { AppKitProvider } from '@reown/appkit/react';
import { createAppKit } from '@reown/appkit/react';

import { WagmiProvider } from 'wagmi';
import {
  mainnet,
  celo,
} from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from https://cloud.reown.com
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

// 2. Create a metadata object
const metadata = {
  name: 'ecolabs Token Manager',
  description: 'Manage Tokens with Reown',
  url: "https://token.celopg.eco/",
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// 3. Set the networks
const networks = [mainnet, celo];

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
  </AppKitProvider>,
);
