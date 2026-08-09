import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi } from '@/services/hostsApi'
import { tagsApi } from '@/services/tagsApi'
import { agentsApi } from '@/services/agentsApi'
import { ApiError } from '@/services/apiClient'
import type { BillingCycle, CreateHostPayload, Host } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Toggle } from '@/components/ui/Toggle'
import { toast, toastCopy } from '@/components/ui/Toast'
import { buildAgentInstallBundle } from '@/features/hosts/agentInstall'
import { countryFlag } from '@/lib/countryFlag'
import { HostPluginMetricCell, HostPluginPanels } from '@/plugins/HostPluginPanels'
import { findHaPowerInstallId } from '@/plugins/EnergyCalendar'
import { usePluginUiBundle, useSlotContributions } from '@/plugins/usePluginUiBundle'
import { pluginsApi } from '@/services/pluginsApi'

type EnrollState = {
  host: Host
  agentId: string
  secret: string
  coreUrl: string
  script: string
  oneLiner: string
  binaryBaseUrl?: string
}

function downloadScript(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/x-shellscript' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function HostsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const is2faEnabled = useAuthStore((s) => s.user?.is_2fa_enabled ?? false)
  const hostsQuery = useQuery({ queryKey: ['hosts'], queryFn: () => hostsApi.list() })
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() })

  function require2faForAgent(): boolean {
    if (is2faEnabled) return true
    toast('Enable 2FA to install or rotate agents', 'error')
    navigate('/security/2fa', { state: { from: '/hosts' } })
    return false
  }

  const [tagFilter, setTagFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [proxyFilter, setProxyFilter] = useState<'all' | 'on' | 'off'>('all')
  const [editor, setEditor] = useState<Host | 'new' | null>(null)
  const [enroll, setEnroll] = useState<EnrollState | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pluginColumns = useSlotContributions('hosts.table.columns')

  const filtered = useMemo(() => {
    let rows = hostsQuery.data ?? []
    if (tagFilter !== 'all') {
      rows = rows.filter((h) => h.tags.some((t) => t.id === tagFilter))
    }
    if (statusFilter === 'online') {
      rows = rows.filter((h) => h.agent?.is_online)
    } else if (statusFilter === 'offline') {
      rows = rows.filter((h) => !h.agent?.is_online)
    }
    if (proxyFilter === 'on') rows = rows.filter((h) => h.is_proxy_enabled)
    if (proxyFilter === 'off') rows = rows.filter((h) => !h.is_proxy_enabled)
    return rows
  }, [hostsQuery.data, tagFilter, statusFilter, proxyFilter])

  const proxyMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      hostsApi.setProxy(id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      toast('Proxy setting updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error'),
  })

  const hiddenMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      hostsApi.setHidden(id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      toast('Public visibility updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: (host_ids: string[]) => hostsApi.reorder(host_ids),
    onSuccess: (hosts) => {
      qc.setQueryData(['hosts'], hosts)
      toast('Order updated', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Reorder failed', 'error'),
  })

  function moveHost(id: string, dir: -1 | 1) {
    const all = [...(hostsQuery.data ?? [])]
    const i = all.findIndex((h) => h.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= all.length) return
    const next = [...all]
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
    reorderMutation.mutate(next.map((h) => h.id))
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hostsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      toast('Host removed', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Delete failed', 'error'),
  })

  const enrollMutation = useMutation({
    mutationFn: async (host: Host) => {
      const creds = host.agent
        ? await agentsApi.rotate(host.id)
        : await agentsApi.create(host.id)
      const bundle = buildAgentInstallBundle({
        agentId: creds.id,
        secret: creds.secret,
      })
      return { host, bundle }
    },
    onSuccess: ({ host, bundle }) => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      setEnroll({
        host,
        agentId: bundle.agentId,
        secret: bundle.secret,
        coreUrl: bundle.coreUrl,
        script: bundle.script,
        oneLiner: bundle.oneLiner,
        binaryBaseUrl: bundle.binaryBaseUrl,
      })
      toast('Agent credentials ready — run install on the host', 'success')
    },
    onError: (err: unknown) =>
      toast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Agent enroll failed',
        'error',
      ),
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dim">
          Metadata only — SSH passwords and private keys stay in GUI/TUI clients.
        </p>
        <Button onClick={() => setEditor('new')}>+ Add host</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-panel px-2 py-1.5 font-mono text-xs text-dim"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All tags</option>
          {(tagsQuery.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-panel px-2 py-1.5 font-mono text-xs text-dim"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All agents</option>
          <option value="online">Online</option>
          <option value="offline">Offline / none</option>
        </select>
        <select
          className="rounded-md border border-border bg-panel px-2 py-1.5 font-mono text-xs text-dim"
          value={proxyFilter}
          onChange={(e) => setProxyFilter(e.target.value as typeof proxyFilter)}
        >
          <option value="all">Proxy any</option>
          <option value="on">Proxy ON</option>
          <option value="off">Proxy OFF</option>
        </select>
      </div>

      <Table
        rows={filtered}
        rowKey={(h) => h.id}
        empty="No hosts match filters"
        expandedKey={expandedId}
        renderExpanded={(h) => (
          <div>
            <HostBillingExpand host={h} />
            <HostPluginPanels host={h} />
          </div>
        )}
        columns={[
          {
            key: 'name',
            header: 'Host',
            render: (h) => (
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setExpandedId((id) => (id === h.id ? null : h.id))}
              >
                <div className="flex items-center gap-1.5 font-medium text-fg-strong">
                  <span className="text-base leading-none" title={h.country_code ?? undefined}>
                    {countryFlag(h.country_code)}
                  </span>
                  <span>{h.name}</span>
                  {expandedId === h.id ? (
                    <span className="font-mono text-[10px] text-neon">▾</span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted">▸</span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted">
                  {h.username}@{h.ip_address ?? 'NAT'}:{h.port}
                </div>
                {h.notes?.trim() ? (
                  <div className="mt-1 line-clamp-2 max-w-xs text-[11px] text-dim">
                    {h.notes}
                  </div>
                ) : null}
              </button>
            ),
          },
          {
            key: 'billing',
            header: 'Billing',
            render: (h) =>
              h.billing_enabled && h.billing_renewal_at ? (
                <button
                  type="button"
                  className="block text-left font-mono text-[11px]"
                  onClick={() => setExpandedId((id) => (id === h.id ? null : h.id))}
                >
                  <div className="text-neon">
                    {h.billing_amount ?? '—'} {h.billing_currency ?? ''}
                    <span className="text-muted"> / {h.billing_cycle ?? '?'}</span>
                  </div>
                  <div className="text-muted">due {h.billing_renewal_at}</div>
                </button>
              ) : (
                <span className="font-mono text-[11px] text-muted">—</span>
              ),
          },
          {
            key: 'agent',
            header: 'Agent',
            render: (h) =>
              h.agent ? (
                <Badge tone={h.agent.is_online ? 'neon' : 'warn'}>
                  {h.agent.is_online ? 'online' : 'offline'}
                  {h.agent.version ? ` · v${h.agent.version}` : ''}
                </Badge>
              ) : (
                <Badge>no agent</Badge>
              ),
          },
          {
            key: 'proxy',
            header: 'SSH Proxy via Agent',
            render: (h) => (
              <Toggle
                checked={h.is_proxy_enabled}
                onChange={(value) => proxyMutation.mutate({ id: h.id, value })}
                label={h.is_proxy_enabled ? 'ON' : 'OFF'}
              />
            ),
          },
          {
            key: 'hidden',
            header: 'Hidden on /u',
            render: (h) => (
              <Toggle
                checked={h.is_hidden}
                onChange={(value) => hiddenMutation.mutate({ id: h.id, value })}
                label={h.is_hidden ? 'yes' : 'no'}
              />
            ),
          },
          {
            key: 'tags',
            header: 'Tags',
            render: (h) => (
              <div className="flex flex-wrap gap-1">
                {h.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded border border-border bg-void px-1.5 py-0.5 font-mono text-[10px]"
                    style={{ color: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            ),
          },
          ...pluginColumns.map((c) => {
            const col = (c.payload.column ?? {}) as {
              header?: string
              bind?: string
              unit?: string
            }
            return {
              key: `plugin:${c.install_id}:${c.contribution_id}`,
              header: col.header ?? c.plugin_name,
              render: (h: Host) => (
                <HostPluginMetricCell
                  host={h}
                  installId={c.install_id}
                  bind={col.bind ?? 'plugin.state.value'}
                  unit={col.unit}
                />
              ),
            }
          }),
          {
            key: 'actions',
            header: '',
            render: (h) => (
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  className="!px-2 !text-xs"
                  title="Move up"
                  disabled={reorderMutation.isPending}
                  onClick={() => moveHost(h.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !text-xs"
                  title="Move down"
                  disabled={reorderMutation.isPending}
                  onClick={() => moveHost(h.id, 1)}
                >
                  ↓
                </Button>
                <Button variant="outline" className="!text-xs" onClick={() => setEditor(h)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => {
                    if (!require2faForAgent()) return
                    enrollMutation.mutate(h)
                  }}
                >
                  {h.agent ? 'Rotate agent' : 'Install agent'}
                </Button>
                <Button
                  variant="danger"
                  className="!text-xs"
                  onClick={() => {
                    if (confirm(`Delete host ${h.name}?`)) deleteMutation.mutate(h.id)
                  }}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editor ? (
        <HostEditorModal
          host={editor === 'new' ? null : editor}
          tagOptions={tagsQuery.data ?? []}
          onClose={() => setEditor(null)}
        />
      ) : null}

      <Modal
        open={Boolean(enroll)}
        title="Install Vortex Agent"
        onClose={() => setEnroll(null)}
        footer={<Button onClick={() => setEnroll(null)}>Done</Button>}
      >
        {enroll ? (
          <div className="flex flex-col gap-3 text-sm text-dim">
            <p>
              One-time secret for <span className="text-neon">{enroll.host.name}</span>. Run the
              script on the server — it uses a shared binary and writes this host&apos;s binding
              into <span className="font-mono text-muted">/etc/vortex-agent.env</span>. Core only
              keeps a hash.
            </p>

            <div className="rounded-md border border-border bg-void p-3 font-mono text-[11px] text-muted">
              <div>core · {enroll.coreUrl}</div>
              <div>agent_id · {enroll.agentId}</div>
              <div>secret · {enroll.secret}</div>
              <div>
                binary · {enroll.binaryBaseUrl}/vortex-agent-linux-{'{amd64|arm64}'}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted">
                Paste on the server
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-void p-3 font-mono text-[11px] text-neon whitespace-pre-wrap break-all">
                {enroll.oneLiner}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => {
                    void toastCopy(enroll.oneLiner, 'Install one-liner copied')
                  }}
                >
                  Copy one-liner
                </Button>
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => {
                    void toastCopy(enroll.script, 'install.sh copied')
                  }}
                >
                  Copy full script
                </Button>
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => {
                    downloadScript(
                      `vortex-agent-install-${enroll.host.name.replace(/\s+/g, '-')}.sh`,
                      enroll.script,
                    )
                    toast('install.sh downloaded', 'success')
                  }}
                >
                  Download install.sh
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function HostBillingExpand({ host }: { host: Host }) {
  if (!host.billing_enabled) {
    return (
      <p className="font-mono text-xs text-muted">
        Billing not tracked — enable in Edit host.
      </p>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Cycle</div>
        <div className="text-sm text-fg-strong">
          {host.billing_cycle}
          {host.billing_cycle === 'custom' && host.billing_custom_days
            ? ` (${host.billing_custom_days}d)`
            : ''}
        </div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Next renewal
        </div>
        <div className="text-sm text-neon">{host.billing_renewal_at ?? '—'}</div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Amount</div>
        <div className="font-mono text-sm text-fg-strong">
          {host.billing_amount ?? '—'} {host.billing_currency ?? ''}
        </div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Auto-renew
        </div>
        <div className="text-sm text-fg-strong">
          {host.billing_auto_renew ? 'on (agent online)' : 'off'}
        </div>
      </div>
      {host.billing_notes?.trim() ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Billing notes
          </div>
          <div className="text-sm text-dim">{host.billing_notes}</div>
        </div>
      ) : null}
    </div>
  )
}

function HostEditorModal({
  host,
  tagOptions,
  onClose,
}: {
  host: Host | null
  tagOptions: { id: string; name: string; color: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(host?.name ?? '')
  const [ip, setIp] = useState(host?.ip_address ?? '')
  const [port, setPort] = useState(String(host?.port ?? 22))
  const [username, setUsername] = useState(host?.username ?? 'root')
  const [notes, setNotes] = useState(host?.notes ?? '')
  const [proxy, setProxy] = useState(host?.is_proxy_enabled ?? false)
  const [tagIds, setTagIds] = useState<string[]>(host?.tags.map((t) => t.id) ?? [])
  const [newTagName, setNewTagName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [billingEnabled, setBillingEnabled] = useState(host?.billing_enabled ?? false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    host?.billing_cycle ?? 'monthly',
  )
  const [billingCustomDays, setBillingCustomDays] = useState(
    String(host?.billing_custom_days ?? 30),
  )
  const [billingRenewalAt, setBillingRenewalAt] = useState(
    host?.billing_renewal_at ?? '',
  )
  const [billingAmount, setBillingAmount] = useState(
    host?.billing_amount != null ? String(host.billing_amount) : '',
  )
  const [billingCurrency, setBillingCurrency] = useState(
    host?.billing_currency ?? 'USD',
  )
  const [billingAutoRenew, setBillingAutoRenew] = useState(
    host?.billing_auto_renew ?? true,
  )
  const [billingNotes, setBillingNotes] = useState(host?.billing_notes ?? '')
  const pluginBundle = usePluginUiBundle()
  const haInstallId = findHaPowerInstallId(pluginBundle.data?.installs)
  const haInstall = pluginBundle.data?.installs.find((i) => i.id === haInstallId)
  const existingEntity =
    host && haInstall
      ? String(
          haInstall.host_bindings.find((b) => b.host_id === host.id)?.config?.entity_id ??
            '',
        )
      : ''
  const [haEntityId, setHaEntityId] = useState(existingEntity)

  const advanceMutation = useMutation({
    mutationFn: () => {
      if (!host) throw new Error('no host')
      return hostsApi.advanceBilling(host.id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      toast('Renewal advanced to next period', 'success')
      onClose()
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Advance failed', 'error'),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const billingPayload = billingEnabled
        ? {
            billing_enabled: true,
            billing_cycle: billingCycle,
            billing_custom_days:
              billingCycle === 'custom' ? Number(billingCustomDays) : null,
            billing_renewal_at: billingRenewalAt || null,
            billing_amount: billingAmount ? billingAmount : null,
            billing_currency: billingCurrency.toUpperCase(),
            billing_auto_renew: billingAutoRenew,
            billing_notes: billingNotes.trim() ? billingNotes.trim() : null,
          }
        : { billing_enabled: false }

      const payload: CreateHostPayload = {
        name,
        ip_address: ip.trim() ? ip.trim() : null,
        port: Number(port),
        username,
        notes: notes.trim() ? notes : null,
        ...(host ? {} : { is_proxy_enabled: proxy }),
        ...billingPayload,
      }

      let saved: Host
      if (host) {
        saved = await hostsApi.update(host.id, {
          name: payload.name,
          ip_address: payload.ip_address,
          port: payload.port,
          username: payload.username,
          notes: payload.notes,
          ...billingPayload,
        })
        if (proxy !== host.is_proxy_enabled) {
          saved = await hostsApi.setProxy(host.id, proxy)
        }
        saved = await hostsApi.setTags(host.id, tagIds)
      } else {
        saved = await hostsApi.create(payload)
        if (tagIds.length > 0) {
          saved = await hostsApi.setTags(saved.id, tagIds)
        }
      }
      if (haInstallId) {
        const entity = haEntityId.trim()
        if (entity) {
          await pluginsApi.setBinding(haInstallId, saved.id, { entity_id: entity })
        } else if (host) {
          await pluginsApi.deleteBinding(haInstallId, saved.id).catch(() => undefined)
        }
      }
      return saved
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      void qc.invalidateQueries({ queryKey: ['tags'] })
      void qc.invalidateQueries({ queryKey: ['billing'] })
      void qc.invalidateQueries({ queryKey: ['plugins'] })
      toast(host ? 'Host updated' : 'Host created', 'success')
      onClose()
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Save failed'),
  })

  const createTagMutation = useMutation({
    mutationFn: () =>
      tagsApi.create({ name: newTagName.trim(), color: '#39FF14' }),
    onSuccess: (tag) => {
      void qc.invalidateQueries({ queryKey: ['tags'] })
      setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]))
      setNewTagName('')
      toast('Tag created', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Could not create tag', 'error'),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <Modal
      open
      title={host ? 'Edit host' : 'Add host'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="host-form" disabled={saveMutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="host-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="IP address (optional for NAT)"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="leave empty if behind NAT"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted">Notes</span>
          <textarea
            className="min-h-[88px] resize-y rounded-md border border-border bg-void px-3 py-2 font-mono text-sm text-fg-strong outline-none transition-colors placeholder:text-muted focus:border-neon/50 focus:neon-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Free-form notes for this host…"
            maxLength={16384}
          />
        </label>
        <Toggle
          checked={proxy}
          onChange={setProxy}
          label="SSH Proxy via Agent (for NAT / firewall)"
        />

        <div className="rounded-md border border-border bg-panel/50 p-3">
          <Toggle
            checked={billingEnabled}
            onChange={setBillingEnabled}
            label="Track renewal / billing"
          />
          {billingEnabled ? (
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted">Cycle</span>
                <select
                  className="rounded-md border border-border bg-void px-3 py-2 font-mono text-sm text-fg-strong"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semiannual">Semiannual</option>
                  <option value="annual">Annual</option>
                  <option value="custom">Custom days</option>
                </select>
              </label>
              {billingCycle === 'custom' ? (
                <Input
                  label="Custom days"
                  type="number"
                  min={1}
                  value={billingCustomDays}
                  onChange={(e) => setBillingCustomDays(e.target.value)}
                  required
                />
              ) : null}
              <Input
                label="Next renewal"
                type="date"
                value={billingRenewalAt}
                onChange={(e) => setBillingRenewalAt(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  min={0}
                  value={billingAmount}
                  onChange={(e) => setBillingAmount(e.target.value)}
                  required
                />
                <Input
                  label="Currency"
                  value={billingCurrency}
                  onChange={(e) => setBillingCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                />
              </div>
              <Toggle
                checked={billingAutoRenew}
                onChange={setBillingAutoRenew}
                label="Auto-advance when overdue & agent online"
              />
              <Input
                label="Billing notes"
                value={billingNotes}
                onChange={(e) => setBillingNotes(e.target.value)}
                placeholder="provider, invoice ref…"
              />
              {host?.billing_enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={advanceMutation.isPending}
                  onClick={() => advanceMutation.mutate()}
                >
                  Advance to next period
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {haInstallId ? (
          <div className="rounded-md border border-border bg-panel/50 p-3">
            <Input
              label="HA power entity (com.vortex.ha_power)"
              value={haEntityId}
              onChange={(e) => setHaEntityId(e.target.value)}
              placeholder="sensor.plug_energy or sensor.xxx_power"
            />
            <p className="mt-1 font-mono text-[10px] text-muted">
              One Home Assistant entity per host. Leave empty to unbind.
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted">Tags</div>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((t) => {
              const active = tagIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                    active ? 'border-neon/40 text-neon' : 'border-border text-muted'
                  }`}
                  onClick={() =>
                    setTagIds((ids) =>
                      active ? ids.filter((id) => id !== t.id) : [...ids, t.id],
                    )
                  }
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="new tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!newTagName.trim() || createTagMutation.isPending}
              onClick={() => createTagMutation.mutate()}
            >
              Add tag
            </Button>
          </div>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
