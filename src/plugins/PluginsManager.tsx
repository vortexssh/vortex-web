import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi, type PluginInstallCreated } from '@/services/pluginsApi'
import { ApiError } from '@/services/apiClient'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { toast, toastCopy } from '@/components/ui/Toast'

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

type PendingInstall =
  | { kind: 'zip'; file: File }
  | { kind: 'manifest'; manifest: Record<string, unknown>; label: string }

export function PluginsManager() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listQuery = useQuery({ queryKey: ['plugins'], queryFn: () => pluginsApi.list() })
  const [pending, setPending] = useState<PendingInstall | null>(null)
  const [credentials, setCredentials] = useState<PluginInstallCreated | null>(null)

  const installMutation = useMutation({
    mutationFn: async (source: PendingInstall) => {
      if (source.kind === 'zip') {
        // Empty config — plugin schemas differ (HA uses poll_interval_seconds, etc.)
        return pluginsApi.installPackage(source.file, {})
      }
      return pluginsApi.install(source.manifest, { interval_seconds: 10 })
    },
    onSuccess: (created) => {
      setCredentials(created)
      setPending(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      void qc.invalidateQueries({ queryKey: ['plugins'] })
      toast('Plugin installed — save the daemon credentials', 'success')
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

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setPending(null)
      return
    }
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.zip')) {
      setPending(null)
      toast('Choose a .zip plugin package', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setPending({ kind: 'zip', file })
  }

  function loadSample() {
    setPending({
      kind: 'manifest',
      manifest: SAMPLE_MANIFEST as Record<string, unknown>,
      label: 'fake-metrics.sample.json',
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onInstall(e: FormEvent) {
    e.preventDefault()
    if (!pending) {
      toast('Choose a plugin .zip first', 'error')
      return
    }
    installMutation.mutate(pending)
  }

  const readyLabel =
    pending?.kind === 'zip'
      ? pending.file.name
      : pending?.kind === 'manifest'
        ? pending.label
        : null

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
        <h3 className="mb-2 text-sm font-medium text-fg-strong">Install from package</h3>
        <p className="mb-3 text-xs text-muted">
          Upload a <code className="text-neon">.zip</code> with{' '}
          <code className="text-neon">vortex-plugin.json</code> at the root (or one folder
          deep). Optional <code className="text-neon">ui/</code> and{' '}
          <code className="text-neon">schemas/</code> are inlined on the server. Daemon
          sources in the archive are ignored. A daemon token is shown once after install.
        </p>
        <form className="flex flex-col gap-3" onSubmit={onInstall}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={onFileChange}
              className="block w-full max-w-md text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-void file:px-3 file:py-1.5 file:text-xs file:text-fg-strong hover:file:border-neon/40"
            />
            <Button type="button" onClick={loadSample}>
              Load sample
            </Button>
          </div>
          {readyLabel ? (
            <p className="font-mono text-[11px] text-dim">
              Ready: <span className="text-neon">{readyLabel}</span>
              {pending?.kind === 'manifest' ? (
                <span className="text-muted"> (inline sample, not a ZIP)</span>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-muted">No package selected.</p>
          )}
          <div>
            <Button
              type="submit"
              disabled={installMutation.isPending || !pending}
            >
              {installMutation.isPending ? 'Installing…' : 'Install plugin'}
            </Button>
          </div>
        </form>
      </section>

      <Modal
        open={Boolean(credentials)}
        title="Plugin installed"
        onClose={() => setCredentials(null)}
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials ? (
          <div className="flex flex-col gap-4 text-sm text-dim">
            <p>
              Copy these values for the daemon env. The token is shown{' '}
              <span className="text-neon">once</span> — Core only keeps a hash.
            </p>

            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                Install ID
              </div>
              <code className="block break-all rounded-md border border-border bg-void px-3 py-2 font-mono text-xs text-fg-strong">
                {credentials.id}
              </code>
              <Button
                variant="outline"
                className="mt-2 !text-xs"
                onClick={() => {
                  void toastCopy(credentials.id, 'Install ID copied')
                }}
              >
                Copy install ID
              </Button>
            </div>

            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                Daemon token
              </div>
              <code className="block break-all rounded-md border border-neon/30 bg-neon/5 px-3 py-2 font-mono text-xs text-neon">
                {credentials.daemon_token}
              </code>
              <Button
                variant="outline"
                className="mt-2 !text-xs"
                onClick={() => {
                  void toastCopy(credentials.daemon_token, 'Daemon token copied')
                }}
              >
                Copy daemon token
              </Button>
            </div>

            <div className="rounded-md border border-border bg-void p-3 font-mono text-[11px] text-muted">
              <div>
                plugin · {credentials.plugin_id} v{credentials.version}
              </div>
              <div className="mt-1 text-[10px] text-dim">
                VORTEX_INSTALL_ID={credentials.id}
                <br />
                VORTEX_DAEMON_TOKEN={credentials.daemon_token}
              </div>
            </div>

            <Button
              variant="outline"
              className="self-start !text-xs"
              onClick={() => {
                void toastCopy(
                  `export VORTEX_INSTALL_ID=${credentials.id}\nexport VORTEX_DAEMON_TOKEN=${credentials.daemon_token}`,
                  'Env exports copied',
                )
              }}
            >
              Copy both as env exports
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
