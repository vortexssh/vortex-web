import { apiRequest } from './apiClient'
import type { Agent, AgentEnrollResponse } from '@/types'

export const agentsApi = {
  list(): Promise<Agent[]> {
    return apiRequest<Agent[]>('/agents')
  },

  enroll(hostId: string): Promise<AgentEnrollResponse> {
    return apiRequest<AgentEnrollResponse>('/agents/enroll', {
      method: 'POST',
      body: { host_id: hostId },
    })
  },
}
