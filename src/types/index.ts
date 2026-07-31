export interface User {
  id: string
  email: string
  is_2fa_enabled: boolean
  created_at: string
}

export interface ApiKey {
  id: string
  user_id: string
  name: string
  key_prefix: string
  expires_at: string | null
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
}

export interface Agent {
  id: string
  host_id: string
  version: string | null
  is_online: boolean
  last_seen_at: string | null
}

export interface Host {
  id: string
  user_id: string
  name: string
  ip_address: string | null
  port: number
  username: string
  is_proxy_enabled: boolean
  tags: Tag[]
  agent: Agent | null
  created_at: string
}

export interface CreateHostPayload {
  name: string
  ip_address?: string | null
  port: number
  username: string
  is_proxy_enabled?: boolean
  tag_ids?: string[]
}

export interface UpdateHostPayload {
  name?: string
  ip_address?: string | null
  port?: number
  username?: string
  is_proxy_enabled?: boolean
  tag_ids?: string[]
}

export interface TelemetryPoint {
  timestamp: string
  cpu_percent: number
  ram_percent: number
  net_rx_mbps: number
  net_tx_mbps: number
  uptime_seconds: number
}

export interface HostTelemetry {
  host_id: string
  points: TelemetryPoint[]
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
}

export interface TaskLog {
  id: string
  task_id: string
  executed_at: string
  status: TaskLogStatus
  exit_code: number
  stdout: string
  stderr: string
}

export interface CreateTaskPayload {
  host_id: string
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
  token_type: 'bearer'
}

export interface LoginResponse extends AuthTokens {
  user: User
  requires_2fa: boolean
}

export interface TotpSetupResponse {
  secret: string
  otpauth_uri: string
}

export interface AgentEnrollResponse {
  agent_id: string
  enroll_token: string
  install_command: string
}

export interface ApiErrorBody {
  detail: string
  code?: string
}

/** @deprecated Use User */
export type UserProfile = User & { display_name?: string }
