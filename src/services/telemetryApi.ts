import { apiRequest } from './apiClient'
import type { ApiKey, ApiKeyCreated, TelemetrySnapshot } from '@/types'

export const telemetryApi = {
  get(hostId: string): Promise<TelemetrySnapshot> {
    return apiRequest<TelemetrySnapshot>(`/hosts/${hostId}/telemetry`)
  },

  history(hostId: string): Promise<TelemetrySnapshot[]> {
    return apiRequest<TelemetrySnapshot[]>(`/hosts/${hostId}/telemetry/history`)
  },
}

export const apiKeysApi = {
  list(): Promise<ApiKey[]> {
    return apiRequest<ApiKey[]>('/api-keys')
  },

  create(payload: {
    name: string
    expires_at?: string | null
  }): Promise<ApiKeyCreated> {
    return apiRequest<ApiKeyCreated>('/api-keys', {
      method: 'POST',
      body: payload,
    })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/api-keys/${id}`, { method: 'DELETE' })
  },
}
