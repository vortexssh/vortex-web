import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/services/authApi'
import { ApiError } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/ui/Toast'

export function Setup2FAPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.is_2fa_enabled) return
    let cancelled = false
    authApi
      .setup2fa()
      .then((res) => {
        if (cancelled) return
        setOtpauthUri(res.otpauth_uri)
        setSecret(res.secret)
      })
      .catch((err: unknown) => {
        toast(err instanceof ApiError ? err.message : 'Failed to start 2FA setup', 'error')
      })
    return () => {
      cancelled = true
    }
  }, [user?.is_2fa_enabled])

  if (user?.is_2fa_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-border bg-panel p-6">
        <h2 className="font-mono text-sm uppercase tracking-wider text-neon">2FA enabled</h2>
        <p className="mt-2 text-sm text-dim">
          Google Authenticator is already linked to this account.
        </p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Go to dashboard
        </Button>
      </div>
    )
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const updated = await authApi.verify2fa(code)
      setUser(updated)
      toast('2FA enabled', 'success')
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-panel p-6">
      <div>
        <h2 className="font-mono text-sm uppercase tracking-wider text-neon">
          Google Authenticator
        </h2>
        <p className="mt-2 text-sm text-dim">
          Agent actions (dashboard, WebSSH, tasks) are locked until TOTP is enabled. Scan the QR
          code, then confirm with a 6-digit code.
        </p>
      </div>

      {otpauthUri ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-void p-4">
          <QRCodeSVG value={otpauthUri} size={180} bgColor="#0a0a0a" fgColor="#39FF14" />
          <p className="font-mono text-[11px] break-all text-muted">secret · {secret}</p>
        </div>
      ) : (
        <p className="font-mono text-xs text-muted">Generating enrollment…</p>
      )}

      <form className="flex flex-col gap-3" onSubmit={onVerify}>
        <Input
          label="Verification code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading || !otpauthUri}>
          {loading ? '…' : 'Enable 2FA'}
        </Button>
      </form>
    </div>
  )
}
