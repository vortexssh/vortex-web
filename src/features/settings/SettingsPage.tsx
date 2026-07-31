import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/services/authApi'
import { apiKeysApi } from '@/services/telemetryApi'
import { ApiError } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [rawKey, setRawKey] = useState<string | null>(null)
  const qc = useQueryClient()

  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysApi.list() })

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      toast('Password updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error'),
  })

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

  const createKeyMutation = useMutation({
    mutationFn: () => apiKeysApi.create({ name: newKeyName }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyName('')
      setRawKey(res.raw_key)
      toast('API key created', 'success')
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast('API key revoked', 'success')
    },
  })

  function onPassword(e: FormEvent) {
    e.preventDefault()
    passwordMutation.mutate()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted">Profile</h2>
        <p className="mt-2 text-sm text-white">{user?.email}</p>
        <div className="mt-2">
          <Badge tone={user?.is_2fa_enabled ? 'neon' : 'warn'}>
            2FA {user?.is_2fa_enabled ? 'enabled' : 'disabled'}
          </Badge>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
          Change password
        </h2>
        <form className="flex flex-col gap-3" onSubmit={onPassword}>
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" disabled={passwordMutation.isPending}>
            Update password
          </Button>
        </form>
      </section>

      {user?.is_2fa_enabled ? (
        <section className="rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
            Disable 2FA
          </h2>
          <p className="mb-3 text-sm text-dim">
            Requires a current authenticator code. Agent features will lock until 2FA is enabled
            again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="6-digit code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              maxLength={6}
            />
            <Button
              variant="danger"
              disabled={disableCode.length !== 6}
              onClick={() => disable2faMutation.mutate()}
            >
              Disable
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
          API keys (GUI / TUI)
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            placeholder="Key name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <Button
            disabled={!newKeyName.trim()}
            onClick={() => createKeyMutation.mutate()}
          >
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
              render: (k) => <span className="text-white">{k.name}</span>,
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
    </div>
  )
}
