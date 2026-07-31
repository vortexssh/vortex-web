import { apiRequest } from './apiClient'
import type { Agent, AgentCreated, AgentRotateResponse } from '@/types'

export const agentsApi = {
  get(hostId: string): Promise<Agent> {
    return apiRequest<Agent>(`/hosts/${hostId}/agents`)
  },

  create(hostId: string): Promise<AgentCreated> {
    return apiRequest<AgentCreated>(`/hosts/${hostId}/agents`, { method: 'POST' })
  },

  rotate(hostId: string): Promise<AgentRotateResponse> {
    return apiRequest<AgentRotateResponse>(`/hosts/${hostId}/agents/rotate`, {
      method: 'POST',
    })
  },

  revoke(hostId: string): Promise<void> {
    return apiRequest<void>(`/hosts/${hostId}/agents`, { method: 'DELETE' })
  },
}
