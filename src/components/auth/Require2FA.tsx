import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Agent-facing routes only. Host inventory + settings stay available without 2FA
 * (ТЗ: block telemetry / WebSSH / tasks — not metadata CRUD).
 */
const AGENT_ROUTE_PREFIXES = ['/', '/terminal', '/tasks'] as const

export function isAgentProtectedPath(pathname: string): boolean {
  if (
    pathname.startsWith('/security') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/hosts') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email')
  ) {
    return false
  }

  return AGENT_ROUTE_PREFIXES.some((prefix) => {
    if (prefix === '/') return pathname === '/'
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

interface Require2FAProps {
  children: ReactNode
}

export function Require2FA({ children }: Require2FAProps) {
  const location = useLocation()
  const is2faEnabled = useAuthStore((s) => s.user?.is_2fa_enabled ?? false)

  if (isAgentProtectedPath(location.pathname) && !is2faEnabled) {
    return (
      <Navigate to="/security/2fa" replace state={{ from: location.pathname }} />
    )
  }

  return children
}
