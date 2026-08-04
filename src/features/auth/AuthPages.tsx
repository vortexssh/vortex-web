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
  const [needsVerification, setNeedsVerification] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
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
    setNeedsVerification(false)
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
      if (err instanceof ApiError && err.code === 'email_not_verified') {
        setNeedsVerification(true)
        setError(err.message)
        return
      }
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function onResend() {
    setResending(true)
    setError(null)
    try {
      const res = await authApi.resendVerification(email)
      toast(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend email')
    } finally {
      setResending(false)
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
        {needsVerification ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={resending || !email}
            onClick={() => void onResend()}
          >
            {resending ? '…' : 'Resend confirmation email'}
          </Button>
        ) : null}
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
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

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
      const res = await authApi.register({ email, password })
      setSentTo(res.email)
      toast(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function onResend() {
    if (!sentTo) return
    setResending(true)
    setError(null)
    try {
      const res = await authApi.resendVerification(sentTo)
      toast(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend email')
    } finally {
      setResending(false)
    }
  }

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="Confirm the address to activate your account"
      >
        <p className="font-mono text-sm text-fg-strong">
          We sent a confirmation link to{' '}
          <span className="text-neon">{sentTo}</span>.
        </p>
        <p className="mt-3 text-sm text-muted">
          Open the link to verify, then sign in.
          {tuiLink
            ? ' After that you can return here with the same TUI link to finish linking.'
            : null}
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={resending}
            onClick={() => void onResend()}
          >
            {resending ? '…' : 'Resend email'}
          </Button>
          <Link
            className="text-center text-sm text-neon hover:underline"
            to={tuiLink ? `/login?${tuiLinkQuery(tuiLink)}` : '/login'}
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create account"
      subtitle={
        tuiLink
          ? 'Register · confirm email · then return to Vortex TUI'
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
          {loading ? '…' : 'Register'}
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

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState('Confirming your email…')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const tokens = await authApi.verifyEmail(token)
        authApi.persistSession(tokens)
        const me = await authApi.me()
        if (cancelled) return
        setSession(me, tokens.access_token)
        setStatus('ok')
        setMessage('Email confirmed — redirecting…')
        toast('Email confirmed')
        navigate(me.is_2fa_enabled ? '/' : '/security/2fa', { replace: true })
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof ApiError ? err.message : 'Verification failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, searchParams, setSession])

  return (
    <AuthShell title="Email verification" subtitle="Activating your Vortex account">
      <p
        className={`font-mono text-sm ${status === 'error' ? 'text-danger' : 'text-muted'}`}
      >
        {message}
      </p>
      {status === 'error' ? (
        <p className="mt-4 text-center text-sm text-muted">
          <Link className="text-neon hover:underline" to="/login">
            Back to sign in
          </Link>
          {' · '}
          <Link className="text-neon hover:underline" to="/register">
            Register again
          </Link>
        </p>
      ) : null}
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
