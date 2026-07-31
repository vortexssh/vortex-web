import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/services/authApi'
import { ApiError } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/ui/Toast'

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState('admin@vortex.local')
  const [password, setPassword] = useState('vortex123')
  const [totpStep, setTotpStep] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (totpStep) {
        const res = await authApi.verifyLoginTotp({ email, code })
        authApi.persistSession(res)
        setSession(res.user, res.access_token)
        navigate(res.user.is_2fa_enabled ? '/' : '/security/2fa')
        return
      }

      const res = await authApi.login({ email, password })
      if (res.requires_2fa) {
        setTotpStep(true)
        toast('Enter your authenticator code')
        return
      }
      authApi.persistSession(res)
      setSession(res.user, res.access_token)
      navigate(res.user.is_2fa_enabled ? '/' : '/security/2fa')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Cloud console · JWT session">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {!totpStep ? (
          <>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <Input
            label="Authenticator code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit TOTP"
            required
          />
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '…' : totpStep ? 'Verify 2FA' : 'Login'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        No account?{' '}
        <Link className="text-neon hover:underline" to="/register">
          Register
        </Link>
      </p>
      <p className="mt-2 text-center font-mono text-[10px] text-muted">
        demo · admin@vortex.local / vortex123
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.register({ email, password })
      authApi.persistSession(res)
      setSession(res.user, res.access_token)
      navigate('/security/2fa')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Metadata-only cloud panel">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '…' : 'Register'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already registered?{' '}
        <Link className="text-neon hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-void p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
        <div className="mb-6 flex items-center gap-2">
          <Activity className="h-5 w-5 text-neon" />
          <div>
            <div className="font-mono text-sm font-semibold text-neon text-glow">VORTEX</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              web console
            </div>
          </div>
        </div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="mb-6 font-mono text-xs text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
