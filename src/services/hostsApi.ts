import { apiRequest } from './apiClient'
import type { CreateHostPayload, Host, UpdateHostPayload } from '@/types'

export const hostsApi = {
  list(params?: { tag_id?: string }): Promise<Host[]> {
    const q = new URLSearchParams()
    if (params?.tag_id) q.set('tag_id', params.tag_id)
    const suffix = q.size ? `?${q}` : ''
    return apiRequest<Host[]>(`/hosts${suffix}`)
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

  setHidden(id: string, is_hidden: boolean): Promise<Host> {
    return apiRequest<Host>(`/hosts/${id}/hidden`, {
      method: 'PATCH',
      body: { is_hidden },
    })
  },

  reorder(host_ids: string[]): Promise<Host[]> {
    return apiRequest<Host[]>('/hosts/reorder', {
      method: 'PATCH',
      body: { host_ids },
    })
  },

  attachTag(hostId: string, tagId: string): Promise<Host> {
    return apiRequest<Host>(`/hosts/${hostId}/tags/${tagId}`, { method: 'POST' })
  },

  detachTag(hostId: string, tagId: string): Promise<Host> {
    return apiRequest<Host>(`/hosts/${hostId}/tags/${tagId}`, { method: 'DELETE' })
  },

  setTags(hostId: string, tag_ids: string[]): Promise<Host> {
    return apiRequest<Host>(`/hosts/${hostId}/tags`, {
      method: 'PUT',
      body: { tag_ids },
    })
  },

  advanceBilling(hostId: string): Promise<Host> {
    return apiRequest<Host>(`/hosts/${hostId}/billing/advance`, { method: 'POST' })
  },
}
