import type { PluginViewContext } from './types'

function getPath(root: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.')
  let cur: unknown = root
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** Resolve bind paths: host.*, install.config, binding.config, plugin.state, action.result */
export function resolveBind(bind: string | undefined, ctx: PluginViewContext): unknown {
  if (!bind) return undefined
  if (bind.startsWith('host.')) return getPath(ctx.host, bind.slice(5))
  if (bind === 'host') return ctx.host
  if (bind.startsWith('install.config')) {
    const rest = bind.slice('install.config'.length).replace(/^\./, '')
    return rest ? getPath(ctx.install?.config, rest) : ctx.install?.config
  }
  if (bind.startsWith('binding.config')) {
    const rest = bind.slice('binding.config'.length).replace(/^\./, '')
    return rest ? getPath(ctx.binding?.config, rest) : ctx.binding?.config
  }
  if (bind.startsWith('plugin.state')) {
    const rest = bind.slice('plugin.state'.length).replace(/^\./, '')
    return rest ? getPath(ctx.pluginState, rest) : ctx.pluginState
  }
  if (bind.startsWith('action.result')) {
    const rest = bind.slice('action.result'.length).replace(/^\./, '')
    return rest ? getPath(ctx.actionResult, rest) : ctx.actionResult
  }
  return getPath(ctx.pluginState, bind)
}

export function evalCondition(expr: string | undefined, ctx: PluginViewContext): boolean {
  if (!expr) return true
  // Simple: "plugin.state.power_w" truthy, or "plugin.state.online == true"
  const eq = expr.match(/^(.+?)\s*==\s*(.+)$/)
  if (eq?.[1] != null && eq[2] != null) {
    const left = resolveBind(eq[1].trim(), ctx)
    const rightRaw = eq[2].trim()
    let right: unknown = rightRaw
    if (rightRaw === 'true') right = true
    else if (rightRaw === 'false') right = false
    else if (rightRaw === 'null') right = null
    else if (/^-?\d+(\.\d+)?$/.test(rightRaw)) right = Number(rightRaw)
    else if (
      (rightRaw.startsWith('"') && rightRaw.endsWith('"')) ||
      (rightRaw.startsWith("'") && rightRaw.endsWith("'"))
    ) {
      right = rightRaw.slice(1, -1)
    } else {
      right = resolveBind(rightRaw, ctx)
    }
    return left === right
  }
  const val = resolveBind(expr.trim(), ctx)
  return Boolean(val)
}

export function formatValue(value: unknown, unit?: string): string {
  if (value == null) return '—'
  if (typeof value === 'number') {
    const n = Number.isInteger(value) ? String(value) : value.toFixed(1)
    return unit ? `${n} ${unit}` : n
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'object') return JSON.stringify(value)
  return unit ? `${String(value)} ${unit}` : String(value)
}

export function pluginRouteToPath(route: string, pluginId: string): string {
  // plugin:com.example.fake/home → /plugins/com.example.fake/home
  if (route.startsWith('plugin:')) {
    const rest = route.slice('plugin:'.length)
    const slash = rest.indexOf('/')
    if (slash === -1) return `/plugins/${encodeURIComponent(rest)}`
    const id = rest.slice(0, slash)
    const path = rest.slice(slash + 1)
    return `/plugins/${encodeURIComponent(id)}/${path}`
  }
  if (route.startsWith('/')) return route
  return `/plugins/${encodeURIComponent(pluginId)}/${route}`
}
