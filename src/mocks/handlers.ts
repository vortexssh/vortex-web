import { http, HttpResponse } from 'msw'
import { db } from './db'
import type {
  CreateHostPayload,
  CreateTaskPayload,
  UpdateHostPayload,
  UpdateTaskPayload,
} from '@/types'

function authUser(request: Request) {
  return db.userFromAuth(request.headers.get('Authorization'))
}

function unauthorized() {
  return HttpResponse.json(
    { detail: 'Unauthorized', code: 'UNAUTHORIZED' },
    { status: 401 },
  )
}

function badRequest(detail: string, code = 'BAD_REQUEST') {
  return HttpResponse.json({ detail, code }, { status: 400 })
}

export const handlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body.email || !body.password || body.password.length < 8) {
      return badRequest('Email and password (min 8 chars) required')
    }
    const existing = db.getUser()
    if (existing.email === body.email) {
      return HttpResponse.json(
        { detail: 'Email already registered', code: 'EMAIL_TAKEN' },
        { status: 409 },
      )
    }
    db.setUser({
      ...existing,
      email: body.email,
      password: body.password,
      is_2fa_enabled: false,
      totp_secret: null,
      pending_totp_secret: null,
    })
    const token = db.issueToken(db.USER_ID)
    return HttpResponse.json({
      access_token: token,
      token_type: 'bearer',
      requires_2fa: false,
      user: db.publicUser(),
    })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    const user = db.getUser()
    if (body.email !== user.email || body.password !== user.password) {
      return HttpResponse.json(
        { detail: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      )
    }
    if (user.is_2fa_enabled) {
      db.pending2faLogins.set(user.email, 'pending')
      return HttpResponse.json({
        access_token: '',
        token_type: 'bearer',
        requires_2fa: true,
        user: db.publicUser(),
      })
    }
    const token = db.issueToken(user.id)
    return HttpResponse.json({
      access_token: token,
      token_type: 'bearer',
      requires_2fa: false,
      user: db.publicUser(),
    })
  }),

  http.post('/api/auth/login/2fa', async ({ request }) => {
    const body = (await request.json()) as { email?: string; code?: string }
    const user = db.getUser()
    if (
      body.email !== user.email ||
      !db.pending2faLogins.has(user.email) ||
      !body.code ||
      body.code.length !== 6
    ) {
      return badRequest('Invalid 2FA code', 'INVALID_TOTP')
    }
    // Mock accepts any 6-digit code
    if (!/^\d{6}$/.test(body.code)) {
      return badRequest('Invalid 2FA code', 'INVALID_TOTP')
    }
    db.pending2faLogins.delete(user.email)
    const token = db.issueToken(user.id)
    return HttpResponse.json({
      access_token: token,
      token_type: 'bearer',
      requires_2fa: false,
      user: db.publicUser(),
    })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json(null, { status: 204 })),

  http.get('/api/auth/me', ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(user)
  }),

  http.post('/api/auth/2fa/setup', ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    const secret = 'JBSWY3DPEHPK3PXP'
    const dbUser = db.getUser()
    db.setUser({ ...dbUser, pending_totp_secret: secret })
    return HttpResponse.json({
      secret,
      otpauth_uri: `otpauth://totp/Vortex:${encodeURIComponent(dbUser.email)}?secret=${secret}&issuer=Vortex`,
    })
  }),

  http.post('/api/auth/2fa/verify', async ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as { code?: string }
    if (!body.code || !/^\d{6}$/.test(body.code)) {
      return badRequest('Invalid TOTP code', 'INVALID_TOTP')
    }
    const dbUser = db.getUser()
    const secret = dbUser.pending_totp_secret ?? dbUser.totp_secret
    if (!secret) return badRequest('No pending 2FA setup')
    db.setUser({
      ...dbUser,
      totp_secret: secret,
      pending_totp_secret: null,
      is_2fa_enabled: true,
    })
    return HttpResponse.json(db.publicUser())
  }),

  http.post('/api/auth/2fa/disable', async ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as { code?: string }
    if (!body.code || !/^\d{6}$/.test(body.code)) {
      return badRequest('Invalid TOTP code', 'INVALID_TOTP')
    }
    const dbUser = db.getUser()
    db.setUser({
      ...dbUser,
      is_2fa_enabled: false,
      totp_secret: null,
      pending_totp_secret: null,
    })
    return HttpResponse.json(db.publicUser())
  }),

  http.post('/api/auth/password', async ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as {
      current_password?: string
      new_password?: string
    }
    const dbUser = db.getUser()
    if (body.current_password !== dbUser.password) {
      return badRequest('Current password incorrect')
    }
    if (!body.new_password || body.new_password.length < 8) {
      return badRequest('New password must be at least 8 characters')
    }
    db.setUser({ ...dbUser, password: body.new_password })
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/hosts', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.hosts)
  }),

  http.get('/api/hosts/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    return HttpResponse.json(host)
  }),

  http.post('/api/hosts', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as CreateHostPayload
    if (!body.name || !body.username || !body.port) {
      return badRequest('name, username and port are required')
    }
    const host = {
      id: db.uid('hst'),
      user_id: db.USER_ID,
      name: body.name,
      ip_address: body.ip_address ?? null,
      port: body.port,
      username: body.username,
      is_proxy_enabled: body.is_proxy_enabled ?? false,
      tags: db.resolveTags(body.tag_ids ?? []),
      agent: null,
      created_at: new Date().toISOString(),
    }
    db.hosts.push(host)
    return HttpResponse.json(host, { status: 201 })
  }),

  http.patch('/api/hosts/:id', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    const body = (await request.json()) as UpdateHostPayload
    Object.assign(host, {
      name: body.name ?? host.name,
      ip_address: body.ip_address === undefined ? host.ip_address : body.ip_address,
      port: body.port ?? host.port,
      username: body.username ?? host.username,
      is_proxy_enabled: body.is_proxy_enabled ?? host.is_proxy_enabled,
      tags: body.tag_ids ? db.resolveTags(body.tag_ids) : host.tags,
    })
    return HttpResponse.json(host)
  }),

  http.delete('/api/hosts/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.hosts.findIndex((h) => h.id === params.id)
    if (idx < 0) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    db.hosts.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.patch('/api/hosts/:id/proxy', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    const body = (await request.json()) as { is_proxy_enabled?: boolean }
    host.is_proxy_enabled = Boolean(body.is_proxy_enabled)
    return HttpResponse.json(host)
  }),

  http.put('/api/hosts/:id/tags', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    const body = (await request.json()) as { tag_ids?: string[] }
    host.tags = db.resolveTags(body.tag_ids ?? [])
    return HttpResponse.json(host)
  }),

  http.get('/api/hosts/:id/telemetry', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const hostId = String(params.id)
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    let points = db.telemetryByHost[hostId] ?? []
    if (from) {
      const fromTs = Date.parse(from)
      points = points.filter((p) => Date.parse(p.timestamp) >= fromTs)
    }
    if (to) {
      const toTs = Date.parse(to)
      points = points.filter((p) => Date.parse(p.timestamp) <= toTs)
    }
    return HttpResponse.json({ host_id: hostId, points })
  }),

  http.get('/api/tags', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.tags)
  }),

  http.post('/api/tags', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { name?: string; color?: string }
    if (!body.name || !body.color) return badRequest('name and color required')
    const tag = {
      id: db.uid('tag'),
      user_id: db.USER_ID,
      name: body.name,
      color: body.color,
    }
    db.tags.push(tag)
    return HttpResponse.json(tag, { status: 201 })
  }),

  http.delete('/api/tags/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.tags.findIndex((t) => t.id === params.id)
    if (idx < 0) {
      return HttpResponse.json({ detail: 'Tag not found' }, { status: 404 })
    }
    const [removed] = db.tags.splice(idx, 1)
    for (const host of db.hosts) {
      host.tags = host.tags.filter((t) => t.id !== removed?.id)
    }
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/agents', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(
      db.hosts.map((h) => h.agent).filter((a): a is NonNullable<typeof a> => a !== null),
    )
  }),

  http.post('/api/agents/enroll', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { host_id?: string }
    const host = body.host_id ? db.findHost(body.host_id) : undefined
    if (!host) {
      return HttpResponse.json({ detail: 'Host not found' }, { status: 404 })
    }
    const agentId = host.agent?.id ?? db.uid('agt')
    const enrollToken = `enr_${crypto.randomUUID().slice(0, 12)}`
    host.agent = {
      id: agentId,
      host_id: host.id,
      version: host.agent?.version ?? null,
      is_online: host.agent?.is_online ?? false,
      last_seen_at: host.agent?.last_seen_at ?? null,
    }
    return HttpResponse.json({
      agent_id: agentId,
      enroll_token: enrollToken,
      install_command: `curl -fsSL https://get.vortex.sh/agent | sudo bash -s -- --token ${enrollToken} --agent-id ${agentId}`,
    })
  }),

  http.get('/api/tasks', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.tasks)
  }),

  http.post('/api/tasks', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as CreateTaskPayload
    if (!body.host_id || !body.name || !body.command) {
      return badRequest('host_id, name and command required')
    }
    const task = {
      id: db.uid('tsk'),
      host_id: body.host_id,
      name: body.name,
      command: body.command,
      cron_expr: body.cron_expr ?? null,
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
    }
    db.tasks.push(task)
    return HttpResponse.json(task, { status: 201 })
  }),

  http.patch('/api/tasks/:id', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const task = db.tasks.find((t) => t.id === params.id)
    if (!task) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 })
    }
    const body = (await request.json()) as UpdateTaskPayload
    Object.assign(task, {
      name: body.name ?? task.name,
      command: body.command ?? task.command,
      cron_expr: body.cron_expr === undefined ? task.cron_expr : body.cron_expr,
      is_active: body.is_active ?? task.is_active,
    })
    return HttpResponse.json(task)
  }),

  http.delete('/api/tasks/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.tasks.findIndex((t) => t.id === params.id)
    if (idx < 0) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 })
    }
    db.tasks.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/tasks/:id/logs', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.taskLogs.filter((l) => l.task_id === params.id))
  }),

  http.post('/api/tasks/:id/run', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const task = db.tasks.find((t) => t.id === params.id)
    if (!task) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 })
    }
    const host = db.findHost(task.host_id)
    if (!host?.agent?.is_online) {
      return badRequest('Agent offline', 'AGENT_OFFLINE')
    }
    const log = {
      id: db.uid('log'),
      task_id: task.id,
      executed_at: new Date().toISOString(),
      status: 'SUCCESS' as const,
      exit_code: 0,
      stdout: `$ ${task.command}\n[mock] executed successfully\n`,
      stderr: '',
    }
    db.taskLogs.unshift(log)
    return HttpResponse.json(log)
  }),

  http.get('/api/api-keys', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.apiKeys)
  }),

  http.post('/api/api-keys', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as {
      name?: string
      expires_at?: string | null
    }
    if (!body.name) return badRequest('name required')
    const raw = `vx_live_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    const key = {
      id: db.uid('key'),
      user_id: db.USER_ID,
      name: body.name,
      key_prefix: raw.slice(0, 12),
      expires_at: body.expires_at ?? null,
      created_at: new Date().toISOString(),
    }
    db.apiKeys.push(key)
    return HttpResponse.json({ ...key, raw_key: raw }, { status: 201 })
  }),

  http.delete('/api/api-keys/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.apiKeys.findIndex((k) => k.id === params.id)
    if (idx < 0) {
      return HttpResponse.json({ detail: 'Key not found' }, { status: 404 })
    }
    db.apiKeys.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),
]
