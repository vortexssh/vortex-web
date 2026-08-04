import { apiRequest } from './apiClient'
import type { PublicStatusPage } from '@/types'

export const publicApi = {
  getStatus(slug: string): Promise<PublicStatusPage> {
    return apiRequest<PublicStatusPage>(`/public/u/${encodeURIComponent(slug)}`, {
      auth: false,
    })
  },
}
