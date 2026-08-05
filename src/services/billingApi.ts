import { apiRequest } from './apiClient'
import type {
  BillingCalendarResponse,
  BillingSummaryResponse,
  NotificationSettings,
  AppNotification,
  TelegramLinkResponse,
  TelegramStatus,
} from '@/types'

export const billingApi = {
  summary(from: string, to: string): Promise<BillingSummaryResponse> {
    const q = new URLSearchParams({ from, to })
    return apiRequest<BillingSummaryResponse>(`/billing/summary?${q}`)
  },

  calendar(year: number, month: number): Promise<BillingCalendarResponse> {
    const q = new URLSearchParams({ year: String(year), month: String(month) })
    return apiRequest<BillingCalendarResponse>(`/billing/calendar?${q}`)
  },

  advance(hostId: string) {
    return apiRequest(`/hosts/${hostId}/billing/advance`, { method: 'POST' })
  },

  getNotificationSettings(): Promise<NotificationSettings> {
    return apiRequest<NotificationSettings>('/users/me/notification-settings')
  },

  updateNotificationSettings(
    payload: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    return apiRequest<NotificationSettings>('/users/me/notification-settings', {
      method: 'PATCH',
      body: payload,
    })
  },

  telegramStatus(): Promise<TelegramStatus> {
    return apiRequest<TelegramStatus>('/users/me/telegram')
  },

  telegramLink(): Promise<TelegramLinkResponse> {
    return apiRequest<TelegramLinkResponse>('/users/me/telegram/link', {
      method: 'POST',
    })
  },

  telegramUnlink(): Promise<void> {
    return apiRequest<void>('/users/me/telegram', { method: 'DELETE' })
  },

  listNotifications(unread = false): Promise<AppNotification[]> {
    const q = unread ? '?unread=true' : ''
    return apiRequest<AppNotification[]>(`/notifications${q}`)
  },

  markRead(id: string): Promise<AppNotification> {
    return apiRequest<AppNotification>(`/notifications/${id}/read`, { method: 'POST' })
  },

  markAllRead(): Promise<void> {
    return apiRequest<void>('/notifications/read-all', { method: 'POST' })
  },
}
