import { apiRequest } from './apiClient'
import type {
  CreateTaskPayload,
  Task,
  TaskLog,
  UpdateTaskPayload,
} from '@/types'

export const tasksApi = {
  listForHost(hostId: string): Promise<Task[]> {
    return apiRequest<Task[]>(`/hosts/${hostId}/tasks`)
  },

  /** Aggregate tasks across hosts (Web convenience). */
  async listAll(hostIds: string[]): Promise<Task[]> {
    const batches = await Promise.all(
      hostIds.map((id) => tasksApi.listForHost(id).catch(() => [] as Task[])),
    )
    return batches.flat()
  },

  create(hostId: string, payload: CreateTaskPayload): Promise<Task> {
    return apiRequest<Task>(`/hosts/${hostId}/tasks`, {
      method: 'POST',
      body: payload,
    })
  },

  update(id: string, payload: UpdateTaskPayload): Promise<Task> {
    return apiRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' })
  },

  run(id: string): Promise<Task> {
    return apiRequest<Task>(`/tasks/${id}/run`, { method: 'POST' })
  },

  logs(id: string): Promise<TaskLog[]> {
    return apiRequest<TaskLog[]>(`/tasks/${id}/logs`)
  },
}
