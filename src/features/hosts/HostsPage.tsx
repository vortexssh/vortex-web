import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi } from '@/services/hostsApi'
import { tagsApi } from '@/services/tagsApi'
import { agentsApi } from '@/services/agentsApi'
import { ApiError } from '@/services/apiClient'
import type { CreateHostPayload, Host } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Toggle } from '@/components/ui/Toggle'
import { toast, toastCopy } from '@/components/ui/Toast'
import { buildAgentInstallBundle } from '@/features/hosts/agentInstall'

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
  const hostsQuery = useQuery({ queryKey: ['hosts'], queryFn: () => hostsApi.list() })
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() })

  const [tagFilter, setTagFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [proxyFilter, setProxyFilter] = useState<'all' | 'on' | 'off'>('all')
  const [editor, setEditor] = useState<Host | 'new' | null>(null)
  const [enroll, setEnroll] = useState<EnrollState | null>(null)

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
        columns={[
          {
            key: 'name',
            header: 'Host',
            render: (h) => (
              <div>
                <div className="font-medium text-white">{h.name}</div>
                <div className="font-mono text-[11px] text-muted">
                  {h.username}@{h.ip_address ?? 'NAT'}:{h.port}
                </div>
              </div>
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
          {
            key: 'actions',
            header: '',
            render: (h) => (
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" className="!text-xs" onClick={() => setEditor(h)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => enrollMutation.mutate(h)}
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
  const [proxy, setProxy] = useState(host?.is_proxy_enabled ?? false)
  const [tagIds, setTagIds] = useState<string[]>(host?.tags.map((t) => t.id) ?? [])
  const [newTagName, setNewTagName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateHostPayload = {
        name,
        ip_address: ip.trim() ? ip.trim() : null,
        port: Number(port),
        username,
        ...(host ? {} : { is_proxy_enabled: proxy }),
      }

      let saved: Host
      if (host) {
        saved = await hostsApi.update(host.id, {
          name: payload.name,
          ip_address: payload.ip_address,
          port: payload.port,
          username: payload.username,
        })
        if (proxy !== host.is_proxy_enabled) {
          saved = await hostsApi.setProxy(host.id, proxy)
        }
        const current = new Set(host.tags.map((t) => t.id))
        const next = new Set(tagIds)
        for (const id of next) {
          if (!current.has(id)) saved = await hostsApi.attachTag(host.id, id)
        }
        for (const id of current) {
          if (!next.has(id)) saved = await hostsApi.detachTag(host.id, id)
        }
      } else {
        saved = await hostsApi.create(payload)
        for (const id of tagIds) {
          saved = await hostsApi.attachTag(saved.id, id)
        }
      }
      return saved
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosts'] })
      toast(host ? 'Host updated' : 'Host created', 'success')
      onClose()
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Save failed'),
  })

  const createTagMutation = useMutation({
    mutationFn: () => tagsApi.create({ name: newTagName, color: '#39FF14' }),
    onSuccess: (tag) => {
      void qc.invalidateQueries({ queryKey: ['tags'] })
      setTagIds((ids) => [...ids, tag.id])
      setNewTagName('')
      toast('Tag created', 'success')
    },
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
        <Toggle
          checked={proxy}
          onChange={setProxy}
          label="SSH Proxy via Agent (for NAT / firewall)"
        />
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
              disabled={!newTagName.trim()}
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
