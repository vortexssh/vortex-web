export interface DeclarativeNode {
  type: string
  title?: string
  columns?: number | { key: string; header: string }[]
  children?: DeclarativeNode[]
  visibleIf?: string
  enableIf?: string
  text?: string
  bind?: string
  label?: string
  unit?: string
  tone?: string
  schema?: Record<string, unknown>
  submitAction?: string
  submitLabel?: string
  action?: string
  confirmMessage?: string
  item?: DeclarativeNode
}

export interface PluginUiContribution {
  install_id: string
  plugin_id: string
  plugin_name: string
  slot: string
  contribution_id: string
  payload: Record<string, unknown>
  requires_host_binding: boolean
  view: DeclarativeNode | null
}

export interface PluginHostBinding {
  id: string
  install_id: string
  host_id: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PluginInstall {
  id: string
  plugin_id: string
  name: string
  version: string
  status: string
  is_daemon_online: boolean
  config: Record<string, unknown>
  manifest: Record<string, unknown>
  host_bindings: PluginHostBinding[]
  created_at: string
  updated_at: string
}

export interface PluginUiBundle {
  installs: PluginInstall[]
  contributions: PluginUiContribution[]
}

export interface PluginState {
  install_id: string
  host_id: string | null
  state: Record<string, unknown>
  updated_at: string | null
}

export interface PluginViewContext {
  host?: Record<string, unknown>
  install?: PluginInstall
  binding?: PluginHostBinding | null
  pluginState?: Record<string, unknown>
  actionResult?: Record<string, unknown>
}
