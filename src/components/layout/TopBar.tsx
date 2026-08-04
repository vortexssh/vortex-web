import type { ReactNode } from 'react'
import { Bell, LogOut, Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/services/authApi'
import { Button } from '@/components/ui/Button'

interface TopBarProps {
  title: string
  subtitle?: string
  menuSlot?: ReactNode
}

export function TopBar({ title, subtitle, menuSlot }: TopBarProps) {
  const user = useAuthStore((s) => s.user)
  const clearSession = useAuthStore((s) => s.clearSession)
  const navigate = useNavigate()
  const qc = useQueryClient()

  function logout() {
    authApi.logout()
    clearSession()
    qc.clear()
    navigate('/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        {menuSlot}
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-fg-strong">{title}</h1>
          {subtitle ? (
            <p className="font-mono text-[11px] text-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5 md:flex">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            type="search"
            placeholder="Search hosts…"
            className="w-36 bg-transparent text-xs text-dim outline-none placeholder:text-muted"
          />
        </div>

        <button
          type="button"
          className="rounded-md border border-border p-2 text-dim transition-colors hover:border-neon/40 hover:text-neon"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${user?.is_2fa_enabled ? 'bg-neon shadow-glow-sm' : 'bg-warn'}`}
          />
          <span className="hidden font-mono text-xs text-dim sm:inline">
            {user?.email ?? 'guest'}
          </span>
        </div>

        <Button variant="ghost" className="!px-2" onClick={logout} aria-label="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
