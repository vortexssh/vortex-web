import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/** Agent-facing sections require 2FA per Vortex security policy. */
const PROTECTED_PREFIXES = ['/', '/hosts', '/terminal', '/tasks'] as const

function requiresTwoFactor(pathname: string): boolean {
  if (
    pathname.startsWith('/security') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  ) {
    return false
  }

  return PROTECTED_PREFIXES.some((prefix) => {
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

  if (requiresTwoFactor(location.pathname) && !is2faEnabled) {
    return (
      <Navigate to="/security/2fa" replace state={{ from: location.pathname }} />
    )
  }

  return children
}
