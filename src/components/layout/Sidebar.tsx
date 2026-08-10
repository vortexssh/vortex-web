import { NavLink } from 'react-router-dom'
import {
  Activity,
  LayoutDashboard,
  Server,
  Terminal,
  Clock,
  ShieldCheck,
  Settings,
  X,
  Lock,
  Wallet,
  Puzzle,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSlotContributions } from '@/plugins/usePluginUiBundle'
import { pluginRouteToPath } from '@/plugins/bindings'
import { userSatisfies2faPolicy } from '@/lib/twoFactorPolicy'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, needs2fa: true },
  { to: '/hosts', label: 'Hosts', icon: Server, needs2fa: false },
  { to: '/billing', label: 'Billing', icon: Wallet, needs2fa: false },
  { to: '/terminal', label: 'WebSSH', icon: Terminal, needs2fa: true },
  { to: '/tasks', label: 'Tasks', icon: Clock, needs2fa: true },
  { to: '/security/2fa', label: '2FA Setup', icon: ShieldCheck, needs2fa: false },
  { to: '/settings', label: 'Settings', icon: Settings, needs2fa: false },
] as const

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const twoFaOk = userSatisfies2faPolicy(user)
  const pluginNav = useSlotContributions('nav.items')

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-neon" strokeWidth={2.25} />
            <div className="leading-tight">
              <div className="font-mono text-sm font-semibold tracking-wide text-neon text-glow">
                VORTEX
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                web console
              </div>
            </div>
          </div>
          <button type="button" className="text-muted lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, needs2fa, ...rest }) => {
            const locked = needs2fa && !twoFaOk
            return (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest ? rest.end : false}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-neon/40 bg-neon/10 text-neon border-glow'
                      : 'border-transparent text-dim hover:border-border-active hover:bg-panel hover:text-neon/80',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1">{label}</span>
                {locked ? <Lock className="h-3 w-3 shrink-0 text-warn opacity-80" /> : null}
              </NavLink>
            )
          })}
          {pluginNav.map((c) => {
            const item = (c.payload.item ?? {}) as { label?: string; route?: string }
            const to = pluginRouteToPath(
              item.route ?? `plugin:${c.plugin_id}/home`,
              c.plugin_id,
            )
            return (
              <NavLink
                key={`${c.install_id}:${c.contribution_id}`}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-neon/40 bg-neon/10 text-neon border-glow'
                      : 'border-transparent text-dim hover:border-border-active hover:bg-panel hover:text-neon/80',
                  ].join(' ')
                }
              >
                <Puzzle className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1">{item.label ?? c.plugin_name}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-md border border-border bg-panel px-3 py-2 font-mono text-[10px] text-muted">
            <div className="flex items-center justify-between">
              <span>AGENT LINK</span>
              <span className="text-neon">● LIVE</span>
            </div>
            <div className="mt-1 text-dim">ws://vortex · relay</div>
          </div>
        </div>
      </aside>
    </>
  )
}
