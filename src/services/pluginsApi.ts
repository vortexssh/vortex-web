import { apiRequest } from './apiClient'
import type { PluginInstall, PluginState, PluginUiBundle } from '@/plugins/types'

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
    return apiRequest<PluginInstall & { daemon_token: string }>('/plugins', {
      method: 'POST',
      body: { manifest, config },
    })
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
}
