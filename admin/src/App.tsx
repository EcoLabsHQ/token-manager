import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { PromoCodes } from './pages/PromoCodes'
import { Tokens } from './pages/Tokens'
import { FeesPage } from './pages/FeesPage'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'
import { Loader2 } from 'lucide-react'

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="promo-codes" element={<PromoCodes />} />
        <Route path="tokens" element={<Tokens />} />
        <Route path="fees" element={<FeesPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default App
