export interface User {
  id: string
  email: string
  public_slug: string | null
  is_2fa_enabled: boolean
  is_email_verified: boolean
  is_active: boolean
  preferred_currency: string
  telegram_linked: boolean
  created_at: string
}

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'

export interface HostBillingFields {
  billing_enabled?: boolean
  billing_cycle?: BillingCycle | null
  billing_custom_days?: number | null
  billing_renewal_at?: string | null
  billing_amount?: string | number | null
  billing_currency?: string | null
  billing_auto_renew?: boolean
  billing_notes?: string | null
}

export interface RegisterResponse {
  email: string
  message: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  expires_at: string | null
  created_at: string
}

export interface ApiKeyCreated extends ApiKey {
  key: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at?: string
}

export interface Agent {
  id: string
  host_id: string
  version: string | null
  is_online: boolean
  last_seen_at: string | null
  created_at?: string
}

export interface AgentCreated {
  id: string
  host_id: string
  secret: string
  version: string | null
  is_online: boolean
}

export interface AgentRotateResponse {
  id: string
  host_id: string
  secret: string
}

export interface Host {
  id: string
  name: string
  ip_address: string | null
  port: number
  username: string
  notes: string | null
  country_code: string | null
  sort_order: number
  is_hidden: boolean
  is_proxy_enabled: boolean
  billing_enabled: boolean
  billing_cycle: BillingCycle | null
  billing_custom_days: number | null
  billing_renewal_at: string | null
  billing_amount: string | null
  billing_currency: string | null
  billing_auto_renew: boolean
  billing_notes: string | null
  tags: Tag[]
  agent: Agent | null
  created_at: string
  updated_at: string
}

export interface CreateHostPayload extends HostBillingFields {
  name: string
  ip_address?: string | null
  port: number
  username: string
  notes?: string | null
  country_code?: string | null
  is_hidden?: boolean
  is_proxy_enabled?: boolean
}

export interface UpdateHostPayload extends HostBillingFields {
  name?: string
  ip_address?: string | null
  port?: number
  username?: string
  notes?: string | null
  country_code?: string | null
  is_hidden?: boolean
}

export interface NotificationSettings {
  email_enabled: boolean
  telegram_enabled: boolean
  in_app_enabled: boolean
  client_enabled: boolean
  reminder_offsets_days: number[]
  billing_reminders_enabled: boolean
}

export interface AppNotification {
  id: string
  host_id: string | null
  kind: string
  title: string
  body: string
  payload?: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export interface TelegramStatus {
  linked: boolean
  chat_id: string | null
  linked_at: string | null
  bot_username: string | null
}

export interface TelegramLinkResponse {
  code: string
  deep_link: string
  expires_at: string
  bot_username: string | null
}

export interface BillingHostBrief {
  id: string
  name: string
  billing_amount: string | null
  billing_currency: string | null
  amount_converted: string | null
  country_code: string | null
  is_next: boolean
  cycle: string | null
}

export interface BillingDay {
  date: string
  hosts: BillingHostBrief[]
}

export interface BillingCalendarResponse {
  year: number
  month: number
  currency: string
  days: BillingDay[]
}

export interface BillingSummaryItem {
  host_id: string
  host_name: string
  amount: string
  currency: string
  amount_converted: string | null
  renewal_at: string | null
  cycle: string | null
}

export interface BillingSummaryResponse {
  currency: string
  from_date: string
  to_date: string
  total: string
  items: BillingSummaryItem[]
  skipped: string[]
}

/** Public status page (no IPs / SSH metadata). */
export interface PublicTelemetry {
  cpu_percent: number | null
  ram_percent: number | null
  net_bytes_sent: number | null
  net_bytes_recv: number | null
  uptime_seconds: number | null
  collected_at: string | null
}

export interface PublicHost {
  id: string
  name: string
  country_code: string | null
  agent_online: boolean
  telemetry: PublicTelemetry | null
}

export interface PublicStatusPage {
  slug: string
  hosts: PublicHost[]
}

/** Latest telemetry snapshot from Redis (TTL-backed). */
export interface TelemetrySnapshot {
  host_id: string
  cpu_percent: number | null
  ram_percent: number | null
  ram_used_bytes: number | null
  ram_total_bytes: number | null
  net_bytes_sent: number | null
  net_bytes_recv: number | null
  uptime_seconds: number | null
  collected_at: string | null
}

/** Chart-friendly point derived from polled snapshots. */
export interface TelemetryPoint {
  timestamp: string
  cpu_percent: number
  ram_percent: number
  net_rx_mbps: number
  net_tx_mbps: number
  uptime_seconds: number
}

export type TaskLogStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT'

export interface Task {
  id: string
  host_id: string
  name: string
  command: string
  cron_expr: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaskLog {
  id: string
  task_id: string
  executed_at: string
  status: TaskLogStatus
  exit_code: number | null
  stdout: string | null
  stderr: string | null
}

export interface CreateTaskPayload {
  name: string
  command: string
  cron_expr?: string | null
  is_active?: boolean
}

export interface UpdateTaskPayload {
  name?: string
  command?: string
  cron_expr?: string | null
  is_active?: boolean
}

export interface AuthTokens {
  access_token: string
  token_type: string
}

export interface TotpSetupResponse {
  secret: string
  otpauth_uri: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
