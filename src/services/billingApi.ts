import { apiRequest } from './apiClient'
import type {
  BillingCalendarResponse,
  BillingPayer,
  BillingPayerDetail,
  BillingSummaryResponse,
  NotificationSettings,
  AppNotification,
  TelegramLinkResponse,
  TelegramStatus,
} from '@/types'

export const billingApi = {
  summary(from: string, to: string, payerId?: string): Promise<BillingSummaryResponse> {
    const q = new URLSearchParams({ from, to })
    if (payerId) q.set('payer_id', payerId)
    return apiRequest<BillingSummaryResponse>(`/billing/summary?${q}`)
  },

  calendar(year: number, month: number, payerId?: string): Promise<BillingCalendarResponse> {
    const q = new URLSearchParams({ year: String(year), month: String(month) })
    if (payerId) q.set('payer_id', payerId)
    return apiRequest<BillingCalendarResponse>(`/billing/calendar?${q}`)
  },

  listPayers(): Promise<BillingPayer[]> {
    return apiRequest<BillingPayer[]>('/billing/payers')
  },

  getPayer(payerId: string): Promise<BillingPayerDetail> {
    return apiRequest<BillingPayerDetail>(`/billing/payers/${payerId}`)
  },

  createPayer(payload: { name: string; notes?: string | null }) {
    return apiRequest<BillingPayer>('/billing/payers', { method: 'POST', body: payload })
  },

  updatePayer(payerId: string, payload: { name?: string; notes?: string | null }) {
    return apiRequest<BillingPayer>(`/billing/payers/${payerId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  removePayer(payerId: string) {
    return apiRequest<void>(`/billing/payers/${payerId}`, { method: 'DELETE' })
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
