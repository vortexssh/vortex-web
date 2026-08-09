import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import { ApiError } from '@/services/apiClient'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'

const SAMPLE_MANIFEST = {
  id: 'com.example.fake_metrics',
  name: 'Fake Metrics',
  version: '1.0.0',
  api_version: 1,
  permissions: [
    'host.bind',
    'state.write',
    'rpc',
    'nav',
    'pages',
    'hosts.columns',
    'hosts.panels',
    'settings',
  ],
  config_schema: {
    type: 'object',
    properties: {
      interval_seconds: { type: 'integer', title: 'Poll interval (s)' },
    },
  },
  host_binding_schema: {
    type: 'object',
    properties: {
      label: { type: 'string', title: 'Label' },
    },
  },
  rpc: [{ method: 'refresh' }, { method: 'bump' }],
  ui: {
    contributions: [
      {
        slot: 'nav.items',
        id: 'fake-nav',
        item: {
          label: 'Fake Metrics',
          route: 'plugin:com.example.fake_metrics/home',
        },
      },
      {
        slot: 'routes',
        id: 'fake-home',
        route: 'plugin:com.example.fake_metrics/home',
        view: 'ui/pages/home.json',
      },
      {
        slot: 'hosts.table.columns',
        id: 'fake-value',
        column: {
          header: 'Fake',
          bind: 'plugin.state.value',
          component: 'metric',
        },
      },
      {
        slot: 'hosts.detail.panels',
        id: 'fake-panel',
        view: 'ui/panels/host.json',
        requires_host_binding: false,
      },
      {
        slot: 'settings.tabs',
        id: 'fake-settings',
        label: 'Fake Metrics',
        view: 'ui/pages/settings.json',
      },
    ],
  },
  views: {
    'ui/pages/home.json': {
      type: 'stack',
      children: [
        { type: 'text', text: 'Reference plugin — values come from the daemon.' },
        { type: 'metric', label: 'Global value', bind: 'plugin.state.value', unit: 'u' },
        { type: 'button', label: 'Refresh', action: 'refresh' },
        { type: 'button', label: 'Bump', action: 'bump' },
      ],
    },
    'ui/panels/host.json': {
      type: 'panel',
      title: 'Fake Metrics',
      children: [
        { type: 'metric', label: 'Host value', bind: 'plugin.state.value', unit: 'u' },
        { type: 'button', label: 'Refresh', action: 'refresh' },
      ],
    },
    'ui/pages/settings.json': {
      type: 'stack',
      children: [
        {
          type: 'text',
          text: 'Daemon pushes state to Core. Configure the daemon with the install token.',
        },
        { type: 'metric', label: 'Last value', bind: 'plugin.state.value' },
      ],
    },
  },
}

export function PluginsManager() {
  const qc = useQueryClient()
  const listQuery = useQuery({ queryKey: ['plugins'], queryFn: () => pluginsApi.list() })
  const [manifestJson, setManifestJson] = useState(
    JSON.stringify(SAMPLE_MANIFEST, null, 2),
  )
  const [lastToken, setLastToken] = useState<string | null>(null)

  const installMutation = useMutation({
    mutationFn: async () => {
      const manifest = JSON.parse(manifestJson) as Record<string, unknown>
      return pluginsApi.install(manifest, { interval_seconds: 10 })
    },
    onSuccess: (created) => {
      setLastToken(created.daemon_token)
      void qc.invalidateQueries({ queryKey: ['plugins'] })
      toast('Plugin installed — copy the daemon token', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Install failed', 'error'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => pluginsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['plugins'] })
      toast('Plugin removed', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Remove failed', 'error'),
  })

  function onInstall(e: FormEvent) {
    e.preventDefault()
    installMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-2 text-sm font-medium text-fg-strong">Installed plugins</h3>
        {(listQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No plugins installed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(listQuery.data ?? []).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-void px-3 py-2"
              >
                <div>
                  <div className="text-sm text-fg-strong">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {p.plugin_id} · v{p.version}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.is_daemon_online ? 'neon' : 'warn'}>
                    {p.is_daemon_online ? 'daemon online' : 'daemon offline'}
                  </Badge>
                  <Badge>{p.status}</Badge>
                  <Button
                    type="button"
                    onClick={() => removeMutation.mutate(p.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-2 text-sm font-medium text-fg-strong">Install from manifest</h3>
        <p className="mb-3 text-xs text-muted">
          Paste a <code className="text-neon">vortex-plugin.json</code> (inline views/schemas
          supported). A daemon token is shown once after install.
        </p>
        <form className="flex flex-col gap-3" onSubmit={onInstall}>
          <textarea
            className="min-h-48 w-full rounded-md border border-border bg-void p-3 font-mono text-[11px] text-dim"
            value={manifestJson}
            onChange={(e) => setManifestJson(e.target.value)}
            spellCheck={false}
          />
          <div>
            <Button type="submit" disabled={installMutation.isPending}>
              {installMutation.isPending ? 'Installing…' : 'Install plugin'}
            </Button>
          </div>
        </form>
        {lastToken ? (
          <div className="mt-3 rounded border border-neon/30 bg-neon/5 p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Daemon token (copy now)
            </div>
            <code className="mt-1 block break-all font-mono text-xs text-neon">{lastToken}</code>
          </div>
        ) : null}
      </section>
    </div>
  )
}
