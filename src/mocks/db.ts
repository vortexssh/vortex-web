import type {
  ApiKey,
  Host,
  Tag,
  Task,
  TaskLog,
  TelemetryPoint,
  User,
} from '@/types'

const USER_ID = 'usr_001'

interface DbUser extends User {
  password: string
  totp_secret: string | null
  pending_totp_secret: string | null
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function telemetrySeries(hours: number): TelemetryPoint[] {
  const now = Date.now()
  const points: TelemetryPoint[] = []
  for (let i = hours * 12; i >= 0; i -= 1) {
    const t = now - i * 5 * 60_000
    const wave = Math.sin(i / 3) * 12
    points.push({
      timestamp: new Date(t).toISOString(),
      cpu_percent: Math.max(8, Math.min(96, 38 + wave + (i % 7) * 2)),
      ram_percent: Math.max(20, Math.min(92, 54 + Math.cos(i / 4) * 10)),
      net_rx_mbps: Math.max(0.2, 4.5 + Math.sin(i / 2) * 2.2),
      net_tx_mbps: Math.max(0.1, 2.1 + Math.cos(i / 2.5) * 1.4),
      uptime_seconds: 4_128_400 + (hours * 12 - i) * 300,
    })
  }
  return points
}

const tags: Tag[] = [
  { id: 'tag_prod', user_id: USER_ID, name: 'prod', color: '#39FF14' },
  { id: 'tag_dev', user_id: USER_ID, name: 'dev', color: '#22c55e' },
  { id: 'tag_db', user_id: USER_ID, name: 'db', color: '#86efac' },
  { id: 'tag_edge', user_id: USER_ID, name: 'edge', color: '#a3e635' },
]

const hosts: Host[] = [
  {
    id: 'hst_edge_01',
    user_id: USER_ID,
    name: 'edge-gateway-01',
    ip_address: '10.0.12.8',
    port: 22,
    username: 'root',
    is_proxy_enabled: true,
    tags: [tags[0]!, tags[3]!],
    agent: {
      id: 'agt_edge_01',
      host_id: 'hst_edge_01',
      version: '1.4.2',
      is_online: true,
      last_seen_at: new Date().toISOString(),
    },
    created_at: new Date(Date.now() - 86_400_000 * 30).toISOString(),
  },
  {
    id: 'hst_db_01',
    user_id: USER_ID,
    name: 'postgres-primary',
    ip_address: '10.0.40.2',
    port: 22,
    username: 'ubuntu',
    is_proxy_enabled: true,
    tags: [tags[0]!, tags[2]!],
    agent: {
      id: 'agt_db_01',
      host_id: 'hst_db_01',
      version: '1.4.2',
      is_online: true,
      last_seen_at: new Date().toISOString(),
    },
    created_at: new Date(Date.now() - 86_400_000 * 60).toISOString(),
  },
  {
    id: 'hst_app_03',
    user_id: USER_ID,
    name: 'api-worker-03',
    ip_address: '10.0.22.41',
    port: 22,
    username: 'deploy',
    is_proxy_enabled: false,
    tags: [tags[0]!],
    agent: {
      id: 'agt_app_03',
      host_id: 'hst_app_03',
      version: '1.3.9',
      is_online: true,
      last_seen_at: new Date(Date.now() - 120_000).toISOString(),
    },
    created_at: new Date(Date.now() - 86_400_000 * 10).toISOString(),
  },
  {
    id: 'hst_lab_02',
    user_id: USER_ID,
    name: 'lab-sandbox',
    ip_address: '192.168.88.14',
    port: 22,
    username: 'root',
    is_proxy_enabled: false,
    tags: [tags[1]!],
    agent: null,
    created_at: new Date(Date.now() - 86_400_000 * 5).toISOString(),
  },
]

const tasks: Task[] = [
  {
    id: 'tsk_backup',
    host_id: 'hst_db_01',
    name: 'nightly-backup',
    command: 'pg_dumpall > /var/backups/all.sql',
    cron_expr: '0 2 * * *',
    is_active: true,
    created_at: new Date(Date.now() - 86_400_000 * 14).toISOString(),
  },
  {
    id: 'tsk_rotate',
    host_id: 'hst_edge_01',
    name: 'rotate-nginx-logs',
    command: 'logrotate -f /etc/logrotate.d/nginx',
    cron_expr: '0 0 * * 0',
    is_active: true,
    created_at: new Date(Date.now() - 86_400_000 * 7).toISOString(),
  },
]

const taskLogs: TaskLog[] = [
  {
    id: 'log_1',
    task_id: 'tsk_backup',
    executed_at: new Date(Date.now() - 86_400_000).toISOString(),
    status: 'SUCCESS',
    exit_code: 0,
    stdout: 'backup complete: 1.2GB written\n',
    stderr: '',
  },
  {
    id: 'log_2',
    task_id: 'tsk_rotate',
    executed_at: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    status: 'FAILED',
    exit_code: 1,
    stdout: '',
    stderr: 'logrotate: missing config\n',
  },
]

const apiKeys: ApiKey[] = [
  {
    id: 'key_1',
    user_id: USER_ID,
    name: 'Vortex GUI - Work Laptop',
    key_prefix: 'vx_live_ab12',
    expires_at: null,
    created_at: new Date(Date.now() - 86_400_000 * 20).toISOString(),
  },
]

const telemetryByHost: Record<string, TelemetryPoint[]> = {
  hst_edge_01: telemetrySeries(24),
  hst_db_01: telemetrySeries(24),
  hst_app_03: telemetrySeries(24),
}

const sessions = new Map<string, string>()
const pending2faLogins = new Map<string, string>()

let user: DbUser = {
  id: USER_ID,
  email: 'admin@vortex.local',
  password: 'vortex123',
  is_2fa_enabled: false,
  totp_secret: null,
  pending_totp_secret: null,
  created_at: new Date(Date.now() - 86_400_000 * 90).toISOString(),
}

export const db = {
  USER_ID,
  uid,
  getUser: () => user,
  setUser: (next: DbUser) => {
    user = next
  },
  publicUser: (): User => ({
    id: user.id,
    email: user.email,
    is_2fa_enabled: user.is_2fa_enabled,
    created_at: user.created_at,
  }),
  sessions,
  pending2faLogins,
  tags,
  hosts,
  tasks,
  taskLogs,
  apiKeys,
  telemetryByHost,
  findHost: (id: string) => hosts.find((h) => h.id === id),
  resolveTags: (ids: string[]) => tags.filter((t) => ids.includes(t.id)),
  issueToken: (userId: string) => {
    const token = `tok_${crypto.randomUUID()}`
    sessions.set(token, userId)
    return token
  },
  userFromAuth: (header: string | null): User | null => {
    if (!header?.startsWith('Bearer ')) return null
    const token = header.slice(7)
    const uidVal = sessions.get(token)
    if (!uidVal || uidVal !== user.id) return null
    return db.publicUser()
  },
  livePoint: (hostId: string): TelemetryPoint | null => {
    const series = telemetryByHost[hostId]
    if (!series?.length) return null
    const last = series[series.length - 1]!
    const next: TelemetryPoint = {
      timestamp: new Date().toISOString(),
      cpu_percent: Math.max(
        5,
        Math.min(98, last.cpu_percent + (Math.random() * 8 - 4)),
      ),
      ram_percent: Math.max(
        10,
        Math.min(95, last.ram_percent + (Math.random() * 4 - 2)),
      ),
      net_rx_mbps: Math.max(0.1, last.net_rx_mbps + (Math.random() * 1.2 - 0.6)),
      net_tx_mbps: Math.max(0.1, last.net_tx_mbps + (Math.random() * 0.8 - 0.4)),
      uptime_seconds: last.uptime_seconds + 5,
    }
    series.push(next)
    if (series.length > 500) series.shift()
    return next
  },
}
