import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { AppKitProvider } from '@reown/appkit/react'
import App from './App'
import './index.css'
import { wagmiAdapter, networks, projectId } from './config/wallet'
import { AuthProvider } from './hooks/useAuth'

// Debug: Log environment variables on startup
console.log('🔧 Admin Panel Environment:', {
  apiUrl: import.meta.env.VITE_API_URL || '(not set - using proxy)',
  hasReownId: !!import.meta.env.VITE_REOWN_PROJECT_ID,
  mode: import.meta.env.MODE,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppKitProvider networks={networks as any} projectId={projectId}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    </AppKitProvider>
  </StrictMode>,
)
