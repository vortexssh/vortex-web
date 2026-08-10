import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import type { NotificationSettings, TelegramLinkResponse } from '@/types'
import { PluginsManager } from '@/plugins/PluginsManager'
import { DeclarativeView } from '@/plugins/DeclarativeView'
import { usePluginUiBundle, useSlotContributions } from '@/plugins/usePluginUiBundle'
import { pluginsApi } from '@/services/pluginsApi'
import type { DeclarativeNode } from '@/plugins/types'
import { PayersSection } from '@/features/settings/PayersSection'

type SettingsTab =
  | 'profile'
  | 'billing'
  | 'payers'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'api-keys'
  | 'plugins'
  | `plugin:${string}`

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'billing', label: 'Billing' },
  { id: 'payers', label: 'Payers' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'api-keys', label: 'API keys' },
  { id: 'plugins', label: 'Plugins' },
]

function parseSettingsTab(raw: string | null): SettingsTab {
  if (!raw) return 'profile'
  if (
    raw === 'profile' ||
    raw === 'billing' ||
    raw === 'payers' ||
    raw === 'notifications' ||
    raw === 'security' ||
    raw === 'appearance' ||
    raw === 'api-keys' ||
    raw === 'plugins'
  ) {
    return raw
  }
  if (raw.startsWith('plugin:')) return raw as SettingsTab
  return 'profile'
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseSettingsTab(searchParams.get('tab'))
  const setTab = (next: SettingsTab) => {
    setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true })
  }
  const pluginTabs = useSlotContributions('settings.tabs')
  const bundle = usePluginUiBundle()

  const tabs = [
    ...TABS,
    ...pluginTabs.map((c) => ({
      id: `plugin:${c.install_id}:${c.contribution_id}` as SettingsTab,
      label: c.payload.label ? String(c.payload.label) : c.plugin_name,
    })),
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-44 lg:flex-col">
        {tabs.map((t) => (
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
        {tab === 'payers' ? <PayersSection /> : null}
        {tab === 'notifications' ? <NotificationsSection /> : null}
        {tab === 'security' ? <SecuritySection /> : null}
        {tab === 'appearance' ? <AppearanceSection /> : null}
        {tab === 'api-keys' ? <ApiKeysSection /> : null}
        {tab === 'plugins' ? <PluginsManager /> : null}
        {typeof tab === 'string' && tab.startsWith('plugin:')
          ? (() => {
              const contrib = pluginTabs.find(
                (c) => `plugin:${c.install_id}:${c.contribution_id}` === tab,
              )
              if (!contrib) return null
              const install = bundle.data?.installs.find((i) => i.id === contrib.install_id)
              return (
                <PluginSettingsTab
                  installId={contrib.install_id}
                  view={contrib.view as DeclarativeNode}
                  install={install}
                />
              )
            })()
          : null}
      </div>
    </div>
  )
}

function PluginSettingsTab({
  installId,
  view,
  install,
}: {
  installId: string
  view: DeclarativeNode | null
  install?: { id: string; config: Record<string, unknown>; name: string }
}) {
  const qc = useQueryClient()
  const stateQuery = useQuery({
    queryKey: ['plugins', 'state', installId],
    queryFn: () => pluginsApi.state(installId),
    refetchInterval: 10_000,
  })
  return (
    <DeclarativeView
      node={view ?? { type: 'text', text: 'Empty settings view' }}
      installId={installId}
      ctx={{
        install: install as never,
        pluginState: stateQuery.data?.state ?? {},
      }}
      onStateChange={() => {
        void qc.invalidateQueries({ queryKey: ['plugins', 'state', installId] })
      }}
    />
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
        Spend summaries and calendar convert host bills into this currency (Frankfurter rates).
        Manage named payers in{' '}
        <Link to="/settings?tab=payers" className="text-neon hover:underline">
          Settings → Payers
        </Link>
        .
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

  const [pendingLink, setPendingLink] = useState<TelegramLinkResponse | null>(null)

  const linkMutation = useMutation({
    mutationFn: () => billingApi.telegramLink(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['telegram-status'] })
      const tgLink =
        res.tg_link ||
        (res.bot_username
          ? `tg://resolve?domain=${res.bot_username}&start=${res.code}`
          : res.deep_link)
      const link: TelegramLinkResponse = { ...res, tg_link: tgLink }
      setPendingLink(link)
      // Prefer tg:// — browsers often strip ?start= when t.me redirects to telegram.org.
      window.location.assign(tgLink)
      toast(`Open Telegram and press Start · code ${res.code}`, 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Link failed', 'error'),
  })

  const unlinkMutation = useMutation({
    mutationFn: () => billingApi.telegramUnlink(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['telegram-status'] })
      setPendingLink(null)
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
      </section>

      <EventToggleGroup
        title="Security"
        onToggle={(key, v) => saveMutation.mutate({ [key]: v })}
        items={[
          { key: 'notify_login', label: 'Sign-in to the panel', checked: s.notify_login },
          {
            key: 'notify_password_changed',
            label: 'Password changed',
            checked: s.notify_password_changed,
          },
          { key: 'notify_2fa_enabled', label: '2FA enabled', checked: s.notify_2fa_enabled },
          { key: 'notify_2fa_disabled', label: '2FA disabled', checked: s.notify_2fa_disabled },
        ]}
      />

      <EventToggleGroup
        title="Account"
        onToggle={(key, v) => saveMutation.mutate({ [key]: v })}
        items={[
          {
            key: 'notify_profile_updated',
            label: 'Profile updated',
            checked: s.notify_profile_updated,
          },
          {
            key: 'notify_telegram_linked',
            label: 'Telegram linked',
            checked: s.notify_telegram_linked,
          },
          {
            key: 'notify_telegram_unlinked',
            label: 'Telegram unlinked',
            checked: s.notify_telegram_unlinked,
          },
        ]}
      />

      <EventToggleGroup
        title="Hosts & agents"
        onToggle={(key, v) => saveMutation.mutate({ [key]: v })}
        items={[
          { key: 'notify_host_created', label: 'Host created', checked: s.notify_host_created },
          { key: 'notify_host_updated', label: 'Host updated', checked: s.notify_host_updated },
          { key: 'notify_host_deleted', label: 'Host deleted', checked: s.notify_host_deleted },
          {
            key: 'notify_agent_created',
            label: 'Agent enrolled',
            checked: s.notify_agent_created,
          },
          {
            key: 'notify_agent_rotated',
            label: 'Agent secret rotated',
            checked: s.notify_agent_rotated,
          },
          {
            key: 'notify_agent_revoked',
            label: 'Agent revoked',
            checked: s.notify_agent_revoked,
          },
        ]}
      />

      <EventToggleGroup
        title="API keys & tasks"
        onToggle={(key, v) => saveMutation.mutate({ [key]: v })}
        items={[
          {
            key: 'notify_api_key_created',
            label: 'API key created',
            checked: s.notify_api_key_created,
          },
          {
            key: 'notify_api_key_deleted',
            label: 'API key deleted',
            checked: s.notify_api_key_deleted,
          },
          { key: 'notify_task_created', label: 'Task created', checked: s.notify_task_created },
          { key: 'notify_task_updated', label: 'Task updated', checked: s.notify_task_updated },
          { key: 'notify_task_deleted', label: 'Task deleted', checked: s.notify_task_deleted },
        ]}
      />

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
          Billing
        </h2>
        <div className="flex flex-col gap-3">
          <Toggle
            checked={s.billing_reminders_enabled}
            onChange={(v) => saveMutation.mutate({ billing_reminders_enabled: v })}
            label="Renewal reminders"
          />
          <Toggle
            checked={s.notify_billing_advanced}
            onChange={(v) => saveMutation.mutate({ notify_billing_advanced: v })}
            label="Manual billing advance"
          />
          <Toggle
            checked={s.notify_billing_auto_renewed}
            onChange={(v) => saveMutation.mutate({ notify_billing_auto_renewed: v })}
            label="Auto-renewed period"
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
            : 'Not linked — open the bot in the Telegram app (not the browser).'}
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
        {pendingLink ? (
          <div className="mt-4 space-y-2 rounded border border-border bg-bg p-3 font-mono text-xs">
            <p className="text-muted">
              If Telegram did not open, copy the link into the app or send{' '}
              <span className="text-primary">/start {pendingLink.code}</span> to @
              {pendingLink.bot_username ?? 'the bot'}.
            </p>
            <p className="break-all text-dim">{pendingLink.deep_link}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(pendingLink.deep_link)
                  toast('Link copied', 'success')
                }}
              >
                Copy t.me link
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  window.location.assign(
                    pendingLink.tg_link ?? pendingLink.deep_link,
                  )
                }
              >
                Open app again
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function EventToggleGroup({
  title,
  items,
  onToggle,
}: {
  title: string
  items: { key: keyof NotificationSettings; label: string; checked: boolean }[]
  onToggle: (key: keyof NotificationSettings, value: boolean) => void
}) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Toggle
            key={item.key}
            checked={item.checked}
            onChange={(v) => onToggle(item.key, v)}
            label={item.label}
          />
        ))}
      </div>
    </section>
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
