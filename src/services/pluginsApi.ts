import { apiRequest } from './apiClient'
import type { PluginInstall, PluginState, PluginUiBundle } from '@/plugins/types'
import { materializeManifestFromZip } from '@/plugins/materializePluginZip'

export type PluginInstallCreated = PluginInstall & { daemon_token: string }

export const pluginsApi = {
  list(): Promise<PluginInstall[]> {
    return apiRequest<PluginInstall[]>('/plugins')
  },

  uiBundle(): Promise<PluginUiBundle> {
    return apiRequest<PluginUiBundle>('/plugins/ui-bundle')
  },

  get(installId: string): Promise<PluginInstall> {
    return apiRequest<PluginInstall>(`/plugins/${installId}`)
  },

  install(manifest: Record<string, unknown>, config: Record<string, unknown> = {}) {
    return apiRequest<PluginInstallCreated>('/plugins', {
      method: 'POST',
      body: { manifest, config },
    })
  },

  /**
   * ZIP with vortex-plugin.json (+ optional ui/, schemas/).
   * Unpacks in-browser and installs via POST /plugins — does not require
   * Core /install-package (prod may not have that route yet).
   */
  async installPackage(file: File, config: Record<string, unknown> = {}) {
    const manifest = await materializeManifestFromZip(file)
    return this.install(manifest, config)
  },

  update(
    installId: string,
    payload: { status?: string; config?: Record<string, unknown>; manifest?: Record<string, unknown> },
  ) {
    return apiRequest<PluginInstall>(`/plugins/${installId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  remove(installId: string) {
    return apiRequest<void>(`/plugins/${installId}`, { method: 'DELETE' })
  },

  setBinding(installId: string, hostId: string, config: Record<string, unknown>) {
    return apiRequest(`/plugins/${installId}/bindings/${hostId}`, {
      method: 'PUT',
      body: { config },
    })
  },

  deleteBinding(installId: string, hostId: string) {
    return apiRequest<void>(`/plugins/${installId}/bindings/${hostId}`, {
      method: 'DELETE',
    })
  },

  state(installId: string, hostId?: string): Promise<PluginState> {
    const q = hostId ? `?host_id=${encodeURIComponent(hostId)}` : ''
    return apiRequest<PluginState>(`/plugins/${installId}/state${q}`)
  },

  rpc(
    installId: string,
    method: string,
    params: Record<string, unknown> = {},
    hostId?: string,
  ) {
    return apiRequest<{ result: Record<string, unknown> }>(
      `/plugins/${installId}/rpc/${encodeURIComponent(method)}`,
      {
        method: 'POST',
        body: { params, host_id: hostId ?? null },
      },
    )
  },

  dailyMetrics(
    installId: string,
    opts: { from: string; to: string; metric?: string; hostId?: string },
  ) {
    const q = new URLSearchParams()
    q.set('from', opts.from)
    q.set('to', opts.to)
    q.set('metric', opts.metric ?? 'energy_kwh')
    if (opts.hostId) q.set('host_id', opts.hostId)
    return apiRequest<{
      samples: Array<{
        install_id: string
        host_id: string | null
        metric: string
        day: string
        value: number
        meta: Record<string, unknown>
      }>
    }>(`/plugins/${installId}/metrics/daily?${q}`)
  },
}
