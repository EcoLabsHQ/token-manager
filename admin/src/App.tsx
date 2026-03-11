import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { PromoCodes } from './pages/PromoCodes'
import { Tokens } from './pages/Tokens'
import { FeesPage } from './pages/FeesPage'

function App() {
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
  )
}

export default App
