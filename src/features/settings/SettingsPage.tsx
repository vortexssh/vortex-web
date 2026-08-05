import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/services/authApi'
import { billingApi } from '@/services/billingApi'
import { apiKeysApi } from '@/services/telemetryApi'
import { ApiError } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { THEMES, useThemeStore, type ThemeId } from '@/store/themeStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Toggle } from '@/components/ui/Toggle'
import { toast } from '@/components/ui/Toast'

type SettingsTab =
  | 'profile'
  | 'billing'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'api-keys'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'api-keys', label: 'API keys' },
]

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-44 lg:flex-col">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              tab === t.id
                ? 'border-neon/40 bg-neon/10 text-neon border-glow'
                : 'border-transparent text-dim hover:border-border-active hover:bg-panel'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {tab === 'profile' ? <ProfileSection /> : null}
        {tab === 'billing' ? <BillingPrefsSection /> : null}
        {tab === 'notifications' ? <NotificationsSection /> : null}
        {tab === 'security' ? <SecuritySection /> : null}
        {tab === 'appearance' ? <AppearanceSection /> : null}
        {tab === 'api-keys' ? <ApiKeysSection /> : null}
      </div>
    </div>
  )
}

function OffsetsEditor({
  initial,
  onSave,
}: {
  initial: number[]
  onSave: (parts: number[]) => void
}) {
  const [value, setValue] = useState(initial.join(', '))
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted">
        Reminder offsets (days before renewal)
      </label>
      <Input
        className="mt-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const parts = value
            .split(/[,\s]+/)
            .map((x) => Number(x.trim()))
            .filter((n) => Number.isFinite(n) && n >= 0)
          if (parts.length) onSave(parts)
        }}
        placeholder="7, 3, 1, 0"
      />
      <p className="mt-1 font-mono text-[10px] text-muted">
        Edit and blur to save. Example: 7, 3, 1, 0
      </p>
    </div>
  )
}

function BillingPrefsSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [currency, setCurrency] = useState(user?.preferred_currency ?? 'USD')

  const mutation = useMutation({
    mutationFn: () => authApi.updateMe({ preferred_currency: currency.toUpperCase() }),
    onSuccess: (u) => {
      setUser(u)
      toast('Preferred currency saved', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error'),
  })

  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">
        Account currency
      </h2>
      <p className="mb-4 text-sm text-dim">
        Spend summaries and calendar convert host bills into this currency (Frankfurter / ECB).
      </p>
      <form
        className="flex max-w-xs flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <Input
          label="Preferred currency (ISO 4217)"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          required
        />
        <Button type="submit" disabled={mutation.isPending}>
          Save
        </Button>
      </form>
    </section>
  )
}

function NotificationsSection() {
  const settingsQuery = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => billingApi.getNotificationSettings(),
  })
  const tgQuery = useQuery({
    queryKey: ['telegram-status'],
    queryFn: () => billingApi.telegramStatus(),
  })
  const qc = useQueryClient()
  const s = settingsQuery.data

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof billingApi.updateNotificationSettings>[0]) =>
      billingApi.updateNotificationSettings(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notification-settings'] })
      toast('Notification settings saved', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Save failed', 'error'),
  })

  const linkMutation = useMutation({
    mutationFn: () => billingApi.telegramLink(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['telegram-status'] })
      window.open(res.deep_link, '_blank', 'noopener,noreferrer')
      toast(`Opened Telegram · code ${res.code}`, 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Link failed', 'error'),
  })

  const unlinkMutation = useMutation({
    mutationFn: () => billingApi.telegramUnlink(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['telegram-status'] })
      toast('Telegram unlinked', 'success')
    },
  })

  if (!s) {
    return <p className="font-mono text-xs text-muted">loading…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
          Channels
        </h2>
        <div className="flex flex-col gap-3">
          <Toggle
            checked={s.billing_reminders_enabled}
            onChange={(v) => saveMutation.mutate({ billing_reminders_enabled: v })}
            label="Billing reminders master switch"
          />
          <Toggle
            checked={s.email_enabled}
            onChange={(v) => saveMutation.mutate({ email_enabled: v })}
            label="Email"
          />
          <Toggle
            checked={s.telegram_enabled}
            onChange={(v) => saveMutation.mutate({ telegram_enabled: v })}
            label="Telegram"
          />
          <Toggle
            checked={s.in_app_enabled}
            onChange={(v) => saveMutation.mutate({ in_app_enabled: v })}
            label="In-app (bell)"
          />
          <Toggle
            checked={s.client_enabled}
            onChange={(v) => saveMutation.mutate({ client_enabled: v })}
            label="Client / TUI inbox"
          />
        </div>
        <div className="mt-4">
          <OffsetsEditor
            key={s.reminder_offsets_days.join('-')}
            initial={s.reminder_offsets_days}
            onSave={(parts) => saveMutation.mutate({ reminder_offsets_days: parts })}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">
          Telegram
        </h2>
        <p className="mb-3 text-sm text-dim">
          {tgQuery.data?.linked
            ? `Linked${tgQuery.data.bot_username ? ` via @${tgQuery.data.bot_username}` : ''}`
            : 'Not linked — generate a deep link to connect the official bot.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={linkMutation.isPending}
            onClick={() => linkMutation.mutate()}
          >
            {tgQuery.data?.linked ? 'Re-link' : 'Link Telegram'}
          </Button>
          {tgQuery.data?.linked ? (
            <Button
              variant="ghost"
              disabled={unlinkMutation.isPending}
              onClick={() => unlinkMutation.mutate()}
            >
              Unlink
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function ProfileSection() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)
  const [email, setEmail] = useState(user?.email ?? '')
  const [publicSlug, setPublicSlug] = useState(user?.public_slug ?? '')

  const statusUrl =
    publicSlug.trim().length >= 2
      ? `${window.location.origin}/u/${publicSlug.trim().toLowerCase()}`
      : null

  const profileMutation = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        email,
        public_slug: publicSlug.trim() ? publicSlug.trim().toLowerCase() : null,
      }),
    onSuccess: (u) => {
      if (!u.is_email_verified) {
        clearSession()
        toast('Confirm your new email, then sign in again', 'success')
        navigate('/login', { replace: true })
        return
      }
      setUser(u)
      setPublicSlug(u.public_slug ?? '')
      toast('Profile updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error'),
  })

  function onProfile(e: FormEvent) {
    e.preventDefault()
    profileMutation.mutate()
  }

  async function copyStatusUrl() {
    if (!statusUrl) return
    try {
      await navigator.clipboard.writeText(statusUrl)
      toast('Status URL copied', 'success')
    } catch {
      toast('Could not copy URL', 'error')
    }
  }

  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">Profile</h2>
      <p className="mb-4 text-sm text-dim">Account identity and public status page.</p>
      <form className="flex flex-col gap-3" onSubmit={onProfile}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p className="font-mono text-[10px] text-muted">
          Changing email requires re-confirmation; you will be signed out until verified.
        </p>
        <Input
          label="Public status slug"
          value={publicSlug}
          onChange={(e) => setPublicSlug(e.target.value)}
          placeholder="e.g. timant32"
          pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,62}"
          title="2–63 chars: letters, digits, hyphens"
        />
        <p className="text-xs text-dim">
          Empty disables the public page. Hosts with Hidden=ON are omitted. No IPs shown.
        </p>
        {statusUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-void px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-neon">{statusUrl}</code>
            <Button type="button" variant="outline" className="!text-xs" onClick={() => void copyStatusUrl()}>
              Copy
            </Button>
          </div>
        ) : null}
        <Button type="submit" disabled={profileMutation.isPending}>
          Save profile
        </Button>
      </form>
    </section>
  )
}

function SecuritySection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [disableCode, setDisableCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const disable2faMutation = useMutation({
    mutationFn: () => authApi.disable2fa(disableCode),
    onSuccess: (u) => {
      setUser(u)
      setDisableCode('')
      toast('2FA disabled', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Disable failed', 'error'),
  })

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Password change failed', 'error'),
  })

  function onPassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error')
      return
    }
    passwordMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted">
              Two-factor auth
            </h2>
            <p className="mt-1 text-sm text-dim">
              Required for Dashboard, WebSSH, Tasks and agent enroll.
            </p>
          </div>
          <Badge tone={user?.is_2fa_enabled ? 'neon' : 'warn'}>
            {user?.is_2fa_enabled ? 'enabled' : 'disabled'}
          </Badge>
        </div>
        {!user?.is_2fa_enabled ? (
          <Link to="/security/2fa">
            <Button>Set up Google Authenticator</Button>
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-dim">
              Disabling 2FA locks agent features again until re-enabled.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="6-digit code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                maxLength={8}
              />
              <Button
                variant="danger"
                disabled={disableCode.length < 6}
                onClick={() => disable2faMutation.mutate()}
              >
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">
          Change password
        </h2>
        <p className="mb-4 text-sm text-dim">Updates the account password used for web login.</p>
        <form className="flex flex-col gap-3" onSubmit={onPassword}>
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={passwordMutation.isPending}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  )
}

function AppearanceSection() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">Appearance</h2>
      <p className="mb-4 text-sm text-dim">
        Color themes and panel styles. Preference is stored in this browser.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const active = theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active
                  ? 'border-neon/50 bg-neon/10 border-glow'
                  : 'border-border bg-void hover:border-border-active'
              }`}
            >
              <div className="mb-2 flex gap-1.5">
                {t.preview.map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-full border border-border"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className={`text-sm font-medium ${active ? 'text-neon' : 'text-fg-strong'}`}>
                {t.name}
              </div>
              <div className="mt-0.5 text-xs text-muted">{t.blurb}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ApiKeysSection() {
  const [newKeyName, setNewKeyName] = useState('')
  const [rawKey, setRawKey] = useState<string | null>(null)
  const qc = useQueryClient()
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysApi.list() })

  const createKeyMutation = useMutation({
    mutationFn: () => apiKeysApi.create({ name: newKeyName }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyName('')
      setRawKey(res.key)
      toast('API key created', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Create failed', 'error'),
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast('API key revoked', 'success')
    },
  })

  return (
    <>
      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">
          API keys (GUI / TUI)
        </h2>
        <p className="mb-4 text-sm text-dim">
          Long-lived tokens for desktop and TUI clients. Shown once at creation.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            placeholder="Key name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <Button disabled={!newKeyName.trim()} onClick={() => createKeyMutation.mutate()}>
            Create key
          </Button>
        </div>
        <Table
          rows={keysQuery.data ?? []}
          rowKey={(k) => k.id}
          empty="No API keys"
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (k) => <span className="text-fg-strong">{k.name}</span>,
            },
            {
              key: 'prefix',
              header: 'Prefix',
              render: (k) => (
                <span className="font-mono text-xs text-muted">{k.key_prefix}…</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (k) => (
                <Button
                  variant="danger"
                  className="!text-xs"
                  onClick={() => deleteKeyMutation.mutate(k.id)}
                >
                  Revoke
                </Button>
              ),
            },
          ]}
        />
      </section>

      <Modal
        open={Boolean(rawKey)}
        title="API key created"
        onClose={() => setRawKey(null)}
        footer={<Button onClick={() => setRawKey(null)}>I copied it</Button>}
      >
        <p className="mb-2 text-sm text-dim">
          Copy now — the full key is shown once and never stored in plaintext again.
        </p>
        <pre className="overflow-x-auto rounded-md border border-neon/30 bg-void p-3 font-mono text-xs text-neon">
          {rawKey}
        </pre>
      </Modal>
    </>
  )
}
