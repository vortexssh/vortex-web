export interface User {
  id: string
  email: string
  is_2fa_enabled: boolean
  is_active: boolean
  created_at: string
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
  is_proxy_enabled: boolean
  tags: Tag[]
  agent: Agent | null
  created_at: string
  updated_at: string
}

export interface CreateHostPayload {
  name: string
  ip_address?: string | null
  port: number
  username: string
  notes?: string | null
  is_proxy_enabled?: boolean
}

export interface UpdateHostPayload {
  name?: string
  ip_address?: string | null
  port?: number
  username?: string
  notes?: string | null
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
