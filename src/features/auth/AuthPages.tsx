import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/services/authApi'
import { apiKeysApi } from '@/services/telemetryApi'
import { ApiError } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/ui/Toast'
import {
  buildTuiCallbackUrl,
  parseTuiLinkParams,
  tuiLinkQuery,
  type TuiLinkParams,
} from '@/features/auth/tuiLink'

async function completeTuiLink(link: TuiLinkParams, email: string) {
  const created = await apiKeysApi.create({ name: 'Vortex TUI' })
  if (!created.key?.startsWith('vxk_')) {
    throw new Error('Failed to issue API key for TUI')
  }
  window.location.assign(
    buildTuiCallbackUrl(link.redirectUri, {
      token: created.key,
      state: link.state,
      email,
    }),
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpStep, setTotpStep] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)

  const tuiLink = useMemo(
    () => parseTuiLinkParams(searchParams.toString()),
    [searchParams],
  )

  // Already signed in + TUI device link → mint key and bounce back.
  useEffect(() => {
    if (!tuiLink || !user || !accessToken || linking) return
    let cancelled = false
    setLinking(true)
    void (async () => {
      try {
        await completeTuiLink(tuiLink, user.email)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to link TUI')
          setLinking(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tuiLink, user, accessToken, linking])

  if (user && !tuiLink) return <Navigate to="/" replace />

  async function finishLogin(accessTokenValue: string) {
    authApi.persistSession({ access_token: accessTokenValue, token_type: 'bearer' })
    const me = await authApi.me()
    setSession(me, accessTokenValue)
    if (tuiLink) {
      await completeTuiLink(tuiLink, me.email)
      return
    }
    navigate(me.is_2fa_enabled ? '/' : '/security/2fa')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const tokens = await authApi.login({
        email,
        password,
        totp_code: totpStep ? code : undefined,
      })
      await finishLogin(tokens.access_token)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'totp_required') {
        setTotpStep(true)
        toast('Enter your authenticator code')
        setError(null)
        return
      }
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const subtitle = tuiLink
    ? 'Link Vortex TUI · return to the terminal after sign-in'
    : 'Cloud console · JWT session via Vortex Core'

  if (tuiLink && user && linking && !error) {
    return (
      <AuthShell title="Linking TUI…" subtitle={subtitle}>
        <p className="font-mono text-sm text-muted">Issuing API key and returning to the app…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Sign in" subtitle={subtitle}>
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
          <>
            <p className="font-mono text-xs text-muted">{email}</p>
            <Input
              label="Authenticator code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit TOTP"
              required
            />
          </>
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading || linking} className="w-full">
          {loading || linking ? '…' : totpStep ? 'Verify 2FA' : tuiLink ? 'Login & link TUI' : 'Login'}
        </Button>
        {totpStep ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setTotpStep(false)
              setCode('')
            }}
          >
            Back
          </Button>
        ) : null}
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        No account?{' '}
        <Link
          className="text-neon hover:underline"
          to={tuiLink ? `/register?${tuiLinkQuery(tuiLink)}` : '/register'}
        >
          Register
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const tuiLink = useMemo(
    () => parseTuiLinkParams(searchParams.toString()),
    [searchParams],
  )

  if (user && !tuiLink) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.register({ email, password })
      const tokens = await authApi.login({ email, password })
      authApi.persistSession(tokens)
      const me = await authApi.me()
      setSession(me, tokens.access_token)
      if (tuiLink) {
        await completeTuiLink(tuiLink, me.email)
        return
      }
      navigate('/security/2fa')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle={
        tuiLink
          ? 'Register · then return to Vortex TUI'
          : 'Metadata-only cloud panel'
      }
    >
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
          {loading ? '…' : tuiLink ? 'Register & link TUI' : 'Register'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already registered?{' '}
        <Link
          className="text-neon hover:underline"
          to={tuiLink ? `/login?${tuiLinkQuery(tuiLink)}` : '/login'}
        >
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
        <h1 className="text-lg font-semibold text-fg-strong">{title}</h1>
        <p className="mb-6 font-mono text-xs text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
