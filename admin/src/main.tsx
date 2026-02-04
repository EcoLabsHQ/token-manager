import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Debug: Log environment variables on startup
console.log('🔧 Admin Panel Environment:', {
  apiUrl: import.meta.env.VITE_API_URL || '(not set - using proxy)',
  hasApiKey: !!import.meta.env.VITE_ADMIN_API_KEY,
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
