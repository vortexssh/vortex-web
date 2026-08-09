import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'
import { DeclarativeView } from './DeclarativeView'
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
        }}
      />
    </div>
  )
}
