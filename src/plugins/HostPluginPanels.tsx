import { useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import type { Host } from '@/types'
import { DeclarativeView } from './DeclarativeView'
import {
  EnergyCalendar,
  contributionAppliesToHost,
  findHaPowerInstallId,
  hostHasPluginBinding,
} from './EnergyCalendar'
import { usePluginUiBundle, useSlotContributions } from './usePluginUiBundle'
import type { DeclarativeNode } from './types'

export function HostPluginPanels({ host }: { host: Host }) {
  const contribs = useSlotContributions('hosts.detail.panels')
  const bundle = usePluginUiBundle()
  const installs = bundle.data?.installs
  const qc = useQueryClient()
  const haInstallId = findHaPowerInstallId(installs)
  const haBound = Boolean(
    haInstallId && hostHasPluginBinding(installs, haInstallId, host.id),
  )

  const visible = contribs.filter((c) =>
    contributionAppliesToHost(c, installs, host.id),
  )

  if (visible.length === 0 && !haBound) return null

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        Plugin panels
      </div>
      {visible.map((c) => (
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
            void qc.invalidateQueries({
              queryKey: ['plugins', 'daily', c.install_id],
            })
          }}
        />
      ))}
      {haBound && haInstallId ? (
        <div className="max-w-[220px]">
          <EnergyCalendar installId={haInstallId} hostId={host.id} />
        </div>
      ) : null}
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
  enabled = true,
}: {
  host: Host
  installId: string
  bind: string
  unit?: string
  /** When false (no host binding), render nothing — column stays empty for this row. */
  enabled?: boolean
}) {
  const stateQuery = useQuery({
    queryKey: ['plugins', 'state', installId, host.id],
    queryFn: () => pluginsApi.state(installId, host.id),
    refetchInterval: 15_000,
    enabled,
  })

  if (!enabled) return null

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
