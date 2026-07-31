import { apiRequest } from './apiClient'
import type { Tag } from '@/types'

export const tagsApi = {
  list(): Promise<Tag[]> {
    return apiRequest<Tag[]>('/tags')
  },

  create(payload: { name: string; color: string }): Promise<Tag> {
    return apiRequest<Tag>('/tags', { method: 'POST', body: payload })
  },

  update(id: string, payload: { name?: string; color?: string }): Promise<Tag> {
    return apiRequest<Tag>(`/tags/${id}`, { method: 'PATCH', body: payload })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/tags/${id}`, { method: 'DELETE' })
  },
}
