import { apiRequest } from './apiClient'
import type { ApiKey, HostTelemetry } from '@/types'

export const telemetryApi = {
  history(
    hostId: string,
    params: { from: string; to: string },
  ): Promise<HostTelemetry> {
    const q = new URLSearchParams(params)
    return apiRequest<HostTelemetry>(`/hosts/${hostId}/telemetry?${q}`)
  },
}

export const apiKeysApi = {
  list(): Promise<ApiKey[]> {
    return apiRequest<ApiKey[]>('/api-keys')
  },

  create(payload: {
    name: string
    expires_at?: string | null
  }): Promise<ApiKey & { raw_key: string }> {
    return apiRequest<ApiKey & { raw_key: string }>('/api-keys', {
      method: 'POST',
      body: payload,
    })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/api-keys/${id}`, { method: 'DELETE' })
  },
}
