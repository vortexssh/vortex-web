import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { TwoFactorNag } from '@/components/auth/TwoFactorNag'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Telemetry Dashboard',
    subtitle: 'Real-time load · fleet overview',
  },
  '/hosts': {
    title: 'Host Manager',
    subtitle: 'Inventory · tags · SSH proxy via agent',
  },
  '/billing': {
    title: 'Billing',
    subtitle: 'Renewals calendar · spend in account currency',
  },
  '/terminal': {
    title: 'Web Terminal',
    subtitle: 'Agent-backed shell · no credentials in browser',
  },
  '/tasks': {
    title: 'Task Manager',
    subtitle: 'Cron jobs · remote scripts',
  },
  '/security/2fa': {
    title: 'Two-Factor Auth',
    subtitle: 'Google Authenticator enrollment',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Profile · billing · notifications · security',
  },
}

function resolveMeta(pathname: string) {
  if (pathname.startsWith('/terminal/')) return PAGE_META['/terminal']!
  if (pathname.startsWith('/plugins/')) {
    return {
      title: 'Plugin',
      subtitle: 'Declarative extension · daemon-backed',
    }
  }
  return (
    PAGE_META[pathname] ?? {
      title: 'Vortex Web',
      subtitle: 'Control plane',
    }
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const meta = resolveMeta(pathname)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 bg-void">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          menuSlot={
            <button
              type="button"
              className="rounded-md border border-border p-2 text-dim lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          }
        />
        <TwoFactorNag />
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
