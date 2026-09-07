import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import { DeclarativeView } from './DeclarativeView'
import { EnergyCalendar } from './EnergyCalendar'
import { usePluginUiBundle } from './usePluginUiBundle'
import { pluginRouteToPath } from './bindings'
import type { DeclarativeNode } from './types'

export function PluginPage() {
  const { pluginId = '', '*': splat = '' } = useParams()
  const qc = useQueryClient()
  const bundle = usePluginUiBundle()

  const routeContrib = useMemo(() => {
    const contribs = (bundle.data?.contributions ?? []).filter((c) => c.slot === 'routes')
    const wantedPath = `/plugins/${pluginId}${splat ? `/${splat}` : ''}`
    return contribs.find((c) => {
      const route = String(c.payload.route ?? '')
      return pluginRouteToPath(route, c.plugin_id) === wantedPath
    })
  }, [bundle.data, pluginId, splat])

  const install = bundle.data?.installs.find((i) => i.plugin_id === pluginId)

  const stateQuery = useQuery({
    queryKey: ['plugins', 'state', install?.id],
    queryFn: () => pluginsApi.state(install!.id),
    enabled: Boolean(install?.id),
    refetchInterval: 10_000,
  })

  const [calendarHostId, setCalendarHostId] = useState('')

  if (bundle.isLoading) {
    return <div className="font-mono text-xs text-muted">loading plugins…</div>
  }

  if (!routeContrib || !install) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-8 text-center text-sm text-muted">
        Plugin page not found or plugin disabled.
      </div>
    )
  }

  const view = (routeContrib.view ?? { type: 'text', text: 'Empty view' }) as DeclarativeNode
  const bindings = install.host_bindings ?? []
  const activeCalendarHostId = calendarHostId || bindings[0]?.host_id || ''
  const showEnergy =
    install.plugin_id === 'com.vortex.ha_power' && bindings.length > 0

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-fg-strong">{install.name}</h2>
        <p className="font-mono text-[11px] text-muted">
          {install.plugin_id} · v{install.version} · daemon{' '}
          {install.is_daemon_online ? 'online' : 'offline'}
        </p>
      </div>
      <DeclarativeView
        node={view}
        installId={install.id}
        ctx={{
          install,
          pluginState: stateQuery.data?.state ?? {},
        }}
        onStateChange={() => {
          void qc.invalidateQueries({ queryKey: ['plugins', 'state', install.id] })
          void qc.invalidateQueries({ queryKey: ['plugins', 'daily', install.id] })
          void qc.invalidateQueries({ queryKey: ['plugins'] })
        }}
      />
      {showEnergy ? (
        <div className="flex max-w-xs flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Calendar host
            <select
              className="rounded-md border border-border bg-void px-2 py-1.5 font-mono text-xs text-fg-strong"
              value={activeCalendarHostId}
              onChange={(e) => setCalendarHostId(e.target.value)}
            >
              {bindings.map((b) => (
                <option key={b.host_id} value={b.host_id}>
                  {b.host_id.slice(0, 8)}… · {String((b.config as { entity_id?: string }).entity_id ?? '—')}
                </option>
              ))}
            </select>
          </label>
          {activeCalendarHostId ? (
            <EnergyCalendar installId={install.id} hostId={activeCalendarHostId} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
