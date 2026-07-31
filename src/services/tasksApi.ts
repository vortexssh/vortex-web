import { apiRequest } from './apiClient'
import type {
  CreateTaskPayload,
  Task,
  TaskLog,
  UpdateTaskPayload,
} from '@/types'

export const tasksApi = {
  list(): Promise<Task[]> {
    return apiRequest<Task[]>('/tasks')
  },

  create(payload: CreateTaskPayload): Promise<Task> {
    return apiRequest<Task>('/tasks', { method: 'POST', body: payload })
  },

  update(id: string, payload: UpdateTaskPayload): Promise<Task> {
    return apiRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' })
  },

  run(id: string): Promise<TaskLog> {
    return apiRequest<TaskLog>(`/tasks/${id}/run`, { method: 'POST' })
  },

  logs(id: string): Promise<TaskLog[]> {
    return apiRequest<TaskLog[]>(`/tasks/${id}/logs`)
  },
}
