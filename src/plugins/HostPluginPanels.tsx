import { useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import type { Host } from '@/types'
import { DeclarativeView } from './DeclarativeView'
import { useSlotContributions } from './usePluginUiBundle'
import type { DeclarativeNode } from './types'

export function HostPluginPanels({ host }: { host: Host }) {
  const contribs = useSlotContributions('hosts.detail.panels')
  const qc = useQueryClient()

  if (contribs.length === 0) return null

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        Plugin panels
      </div>
      {contribs.map((c) => (
        <HostPluginPanelItem
          key={`${c.install_id}:${c.contribution_id}`}
          host={host}
          installId={c.install_id}
          pluginName={c.plugin_name}
          view={c.view}
          onInvalidate={() => {
            void qc.invalidateQueries({
              queryKey: ['plugins', 'state', c.install_id, host.id],
            })
          }}
        />
      ))}
    </div>
  )
}

function HostPluginPanelItem({
  host,
  installId,
  pluginName,
  view,
  onInvalidate,
}: {
  host: Host
  installId: string
  pluginName: string
  view: DeclarativeNode | null
  onInvalidate: () => void
}) {
  const stateQuery = useQuery({
    queryKey: ['plugins', 'state', installId, host.id],
    queryFn: () => pluginsApi.state(installId, host.id),
    refetchInterval: 15_000,
  })

  return (
    <DeclarativeView
      node={view ?? { type: 'text', text: pluginName }}
      installId={installId}
      hostId={host.id}
      ctx={{
        host: host as unknown as Record<string, unknown>,
        pluginState: stateQuery.data?.state ?? {},
      }}
      onStateChange={onInvalidate}
    />
  )
}

export function HostPluginMetricCell({
  host,
  installId,
  bind,
  unit,
}: {
  host: Host
  installId: string
  bind: string
  unit?: string
}) {
  const stateQuery = useQuery({
    queryKey: ['plugins', 'state', installId, host.id],
    queryFn: () => pluginsApi.state(installId, host.id),
    refetchInterval: 15_000,
  })

  const state = stateQuery.data?.state ?? {}
  const path = bind.startsWith('plugin.state.') ? bind.slice('plugin.state.'.length) : bind
  let cur: unknown = state
  for (const p of path.split('.')) {
    if (cur == null || typeof cur !== 'object') {
      cur = undefined
      break
    }
    cur = (cur as Record<string, unknown>)[p]
  }
  if (cur == null) return <span className="font-mono text-[11px] text-muted">—</span>
  const text =
    typeof cur === 'number'
      ? `${Number.isInteger(cur) ? cur : cur.toFixed(1)}${unit ? ` ${unit}` : ''}`
      : String(cur)
  return <span className="font-mono text-[11px] text-neon">{text}</span>
}
