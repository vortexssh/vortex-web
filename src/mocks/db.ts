import type {
  ApiKey,
  Host,
  Tag,
  Task,
  TaskLog,
  TelemetrySnapshot,
  User,
} from '@/types'

const USER_ID = '00000000-0000-4000-8000-000000000001'

interface DbUser extends User {
  password: string
  totp_secret: string | null
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

const now = () => new Date().toISOString()

const tags: Tag[] = [
  { id: 'tag_prod', name: 'prod', color: '#39FF14', created_at: now() },
  { id: 'tag_dev', name: 'dev', color: '#22c55e', created_at: now() },
]

const hosts: Host[] = [
  {
    id: 'hst_edge_01',
    name: 'edge-gateway-01',
    ip_address: '10.0.12.8',
    port: 22,
    username: 'root',
    notes: null,
    country_code: 'DE',
    sort_order: 0,
    is_hidden: false,
    is_proxy_enabled: true,
    billing_enabled: false,
    billing_cycle: null,
    billing_custom_days: null,
    billing_renewal_at: null,
    billing_amount: null,
    billing_currency: null,
    billing_auto_renew: true,
    billing_notes: null,
    tags: [tags[0]!],
    agent: {
      id: 'agt_edge_01',
      host_id: 'hst_edge_01',
      version: '1.4.2',
      is_online: true,
      last_seen_at: now(),
    },
    created_at: now(),
    updated_at: now(),
  },
]

const tasks: Task[] = []
const taskLogs: TaskLog[] = []
const apiKeys: ApiKey[] = []
const telemetryByHost: Record<string, TelemetrySnapshot> = {
  hst_edge_01: {
    host_id: 'hst_edge_01',
    cpu_percent: 42,
    ram_percent: 55,
    ram_used_bytes: null,
    ram_total_bytes: null,
    net_bytes_sent: 1_000_000,
    net_bytes_recv: 2_000_000,
    uptime_seconds: 100_000,
    collected_at: now(),
  },
}

const sessions = new Map<string, string>()

let user: DbUser = {
  id: USER_ID,
  email: 'admin@vortex.local',
  public_slug: 'demo',
  password: 'vortex12345',
  is_2fa_enabled: false,
  is_email_verified: true,
  is_active: true,
  preferred_currency: 'USD',
  telegram_linked: false,
  totp_secret: null,
  created_at: now(),
}

const verificationTokens = new Map<string, string>()

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
    public_slug: user.public_slug,
    is_2fa_enabled: user.is_2fa_enabled,
    is_email_verified: user.is_email_verified,
    is_active: user.is_active,
    preferred_currency: user.preferred_currency,
    telegram_linked: user.telegram_linked,
    created_at: user.created_at,
  }),
  issueVerificationToken: (userId: string) => {
    const token = `evt_${crypto.randomUUID().replace(/-/g, '')}`
    verificationTokens.set(token, userId)
    return token
  },
  consumeVerificationToken: (token: string) => {
    const userId = verificationTokens.get(token)
    if (!userId) return null
    verificationTokens.delete(token)
    return userId
  },
  sessions,
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
  bumpTelemetry: (hostId: string): TelemetrySnapshot | null => {
    const cur = telemetryByHost[hostId]
    if (!cur) return null
    const next: TelemetrySnapshot = {
      ...cur,
      cpu_percent: Math.max(5, Math.min(98, (cur.cpu_percent ?? 40) + (Math.random() * 8 - 4))),
      ram_percent: Math.max(10, Math.min(95, (cur.ram_percent ?? 50) + (Math.random() * 4 - 2))),
      net_bytes_recv: (cur.net_bytes_recv ?? 0) + Math.floor(Math.random() * 50_000),
      net_bytes_sent: (cur.net_bytes_sent ?? 0) + Math.floor(Math.random() * 20_000),
      uptime_seconds: (cur.uptime_seconds ?? 0) + 5,
      collected_at: now(),
    }
    telemetryByHost[hostId] = next
    return next
  },
}
