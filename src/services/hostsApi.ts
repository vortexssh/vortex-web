import { apiRequest } from './apiClient'
import type { CreateHostPayload, Host, UpdateHostPayload } from '@/types'

export const hostsApi = {
  list(): Promise<Host[]> {
    return apiRequest<Host[]>('/hosts')
  },

  get(id: string): Promise<Host> {
    return apiRequest<Host>(`/hosts/${id}`)
  },

  create(payload: CreateHostPayload): Promise<Host> {
    return apiRequest<Host>('/hosts', { method: 'POST', body: payload })
  },

  update(id: string, payload: UpdateHostPayload): Promise<Host> {
    return apiRequest<Host>(`/hosts/${id}`, { method: 'PATCH', body: payload })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/hosts/${id}`, { method: 'DELETE' })
  },

  setProxy(id: string, is_proxy_enabled: boolean): Promise<Host> {
    return apiRequest<Host>(`/hosts/${id}/proxy`, {
      method: 'PATCH',
      body: { is_proxy_enabled },
    })
  },

  setTags(id: string, tag_ids: string[]): Promise<Host> {
    return apiRequest<Host>(`/hosts/${id}/tags`, {
      method: 'PUT',
      body: { tag_ids },
    })
  },
}
