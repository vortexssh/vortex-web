import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'

/** Persistent nudge — agent features stay locked until TOTP is on. */
export function TwoFactorNag() {
  const enabled = useAuthStore((s) => s.user?.is_2fa_enabled ?? false)
  if (enabled) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warn/30 bg-warn/10 px-4 py-2 sm:px-6">
      <div className="flex items-start gap-2 text-sm text-warn">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-medium">2FA required for agents.</span>{' '}
          <span className="text-dim">
            Hosts and settings work now; Dashboard, WebSSH and Tasks unlock after Google Authenticator.
          </span>
        </p>
      </div>
      <Link to="/security/2fa">
        <Button variant="outline" className="!border-warn/40 !text-warn !text-xs">
          Enable 2FA
        </Button>
      </Link>
    </div>
  )
}
