import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Tag, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/promo-codes', label: 'Promo Codes', icon: Tag },
  { to: '/tokens', label: 'Tokens', icon: Coins },
]

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-[1px_2px_9px_0px_rgba(0,0,0,0.03)]">
        <div className="flex h-16 items-center gap-2.5 px-6">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <span className="font-semibold text-lg tracking-[-0.3px]">Minter Admin</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <header className="h-16 bg-white shadow-[1px_2px_9px_0px_rgba(0,0,0,0.03)] flex items-center px-6">
          <h1 className="text-lg font-semibold tracking-[-0.3px]">Admin Dashboard</h1>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
