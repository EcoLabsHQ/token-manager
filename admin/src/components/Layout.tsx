import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Tag, Coins, Settings2, Wallet, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/promo-codes', label: 'Promo Codes', icon: Tag },
  { to: '/tokens', label: 'Tokens', icon: Coins },
  { to: '/fees', label: 'Fee Management', icon: Settings2 },
]

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  if (!isConnected || !address) {
    return (
      <button
        onClick={() => open()}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <Wallet className="h-5 w-5" />
        Connect Wallet
      </button>
    )
  }

  return (
    <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs font-medium text-gray-700 truncate">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0 flex items-center gap-0.5"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-[1px_2px_9px_0px_rgba(0,0,0,0.03)] flex flex-col">
        <div className="flex h-16 items-center gap-2.5 px-6 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.98775 12.1049L5.30712 9.84469L6.27053 10.3915C6.29628 10.4062 6.3229 10.4099 6.3473 10.4056C6.41745 10.3933 6.46921 10.3151 6.42899 10.2409L5.77735 9.03914L4.44052 6.57367C4.41995 6.53573 4.37921 6.51261 4.3355 6.51406L2.69946 6.5685L1.22698 6.6175L0.110907 6.65463C0.0254601 6.65748 -0.0175424 6.74065 0.00671431 6.80651C0.0151505 6.82942 0.0317221 6.85024 0.057473 6.86486L1.01275 7.40709C0.502431 9.6789 0.856091 12.0938 2.07373 14.1673C3.67067 16.8867 6.52795 18.6344 9.6828 18.8639V17.5073V14.1303H5.18072C4.12345 14.1303 3.46148 13.0064 3.98775 12.1049Z" fill="white"/>
              <path d="M11.5635 3.21431L12.3804 4.61369L11.2905 5.23232C11.1907 5.28896 11.2288 5.43871 11.344 5.44254L11.6291 5.45203L12.8943 5.49413L15.5686 5.58311C15.6123 5.58457 15.653 5.56144 15.6736 5.5235L16.4935 4.01133L17.1748 2.7548L17.5278 2.10377L17.6621 1.85624C17.7163 1.75626 17.6034 1.64898 17.5036 1.70563L16.5877 2.2255C14.8807 0.810063 12.6957 0 10.3933 0C7.24348 0 4.31321 1.51625 2.526 4.02457L3.72256 4.70376L7.16685 6.65883L9.17757 3.21431C9.7062 2.30873 11.0349 2.30873 11.5635 3.21431Z" fill="white"/>
              <path d="M13.1215 19.7952L12.4136 18.6787L11.6316 17.4454L10.9815 16.42C10.9583 16.3835 10.9583 16.3373 10.9815 16.3008L12.3577 14.1303L13.1215 12.9256L13.2176 12.7741C13.2785 12.678 13.4295 12.7204 13.4295 12.8337V14.1303H15.5604C16.6176 14.1303 17.2796 13.0064 16.7533 12.1049L14.2637 7.83989L17.7682 5.85064L18.9614 5.17332C20.4246 8.00909 20.3417 11.3936 18.713 14.1673C17.5207 16.1975 15.626 17.6861 13.4295 18.4058V19.8871C13.4295 20.0004 13.2785 20.0429 13.2176 19.9467L13.1215 19.7952Z" fill="white"/>
            </svg>
          </div>
          <span className="font-semibold text-lg tracking-[-0.3px]">Token Dashboard</span>
        </div>
        <nav className="p-4 space-y-1 flex-1">
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
        {/* Wallet section at the bottom of sidebar */}
        <div className="p-4 border-t border-gray-100">
          <WalletButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
