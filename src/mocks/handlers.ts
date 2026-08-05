import { http, HttpResponse } from 'msw'
import { db } from './db'
import { mockCountryFromIp } from './geoip'
import type { CreateHostPayload, CreateTaskPayload, UpdateHostPayload, UpdateTaskPayload } from '@/types'

/** Lightweight offline stubs — prefer live Vortex Core (`VITE_USE_MSW=false`). */

function authUser(request: Request) {
  return db.userFromAuth(request.headers.get('Authorization'))
}

function unauthorized() {
  return HttpResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}

function bad(message: string, code = 'BAD_REQUEST', status = 400) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

const defaultNotificationSettings = {
  email_enabled: true,
  telegram_enabled: true,
  in_app_enabled: true,
  client_enabled: true,
  reminder_offsets_days: [7, 3, 1, 0],
  billing_reminders_enabled: true,
  notify_login: true,
  notify_password_changed: true,
  notify_2fa_enabled: true,
  notify_2fa_disabled: true,
  notify_profile_updated: true,
  notify_telegram_linked: true,
  notify_telegram_unlinked: true,
  notify_host_created: true,
  notify_host_updated: true,
  notify_host_deleted: true,
  notify_agent_created: true,
  notify_agent_rotated: true,
  notify_agent_revoked: true,
  notify_api_key_created: true,
  notify_api_key_deleted: true,
  notify_task_created: true,
  notify_task_updated: true,
  notify_task_deleted: true,
  notify_billing_advanced: true,
  notify_billing_auto_renewed: true,
}

export const handlers = [
  http.post('/api/v1/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body.email || !body.password || body.password.length < 8) {
      return bad('Email and password (min 8) required')
    }
    db.setUser({
      ...db.getUser(),
      email: body.email,
      password: body.password,
      is_2fa_enabled: false,
      is_email_verified: false,
      totp_secret: null,
    })
    db.issueVerificationToken(db.getUser().id)
    return HttpResponse.json(
      {
        email: body.email,
        message: 'Check your inbox to confirm your email',
      },
      { status: 201 },
    )
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as {
      email?: string
      password?: string
      totp_code?: string
    }
    const user = db.getUser()
    if (body.email !== user.email || body.password !== user.password) {
      return bad('Invalid credentials', 'invalid_credentials', 401)
    }
    if (!user.is_email_verified) {
      return bad('Confirm your email before signing in', 'email_not_verified', 403)
    }
    if (user.is_2fa_enabled) {
      if (!body.totp_code || body.totp_code.length < 6) {
        return bad('TOTP code required', 'totp_required', 401)
      }
    }
    return HttpResponse.json({
      access_token: db.issueToken(user.id),
      token_type: 'bearer',
    })
  }),

  http.post('/api/v1/auth/verify-email', async ({ request }) => {
    const body = (await request.json()) as { token?: string }
    if (!body.token || body.token.length < 16) {
      return bad('Verification link is invalid or expired', 'invalid_verification_token')
    }
    const userId = db.consumeVerificationToken(body.token)
    const user = db.getUser()
    if (!userId && !body.token.startsWith('evt_')) {
      return bad('Verification link is invalid or expired', 'invalid_verification_token')
    }
    db.setUser({ ...user, is_email_verified: true })
    return HttpResponse.json({
      access_token: db.issueToken(user.id),
      token_type: 'bearer',
    })
  }),

  http.post('/api/v1/auth/resend-verification', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (!body.email) return bad('Email required')
    const user = db.getUser()
    if (user.email === body.email && !user.is_email_verified) {
      db.issueVerificationToken(user.id)
    }
    return HttpResponse.json({
      email: body.email,
      message: 'If that address needs verification, a new email was sent',
    })
  }),

  http.get('/api/v1/users/me', ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    return HttpResponse.json(user)
  }),

  http.patch('/api/v1/users/me', async ({ request }) => {
    const user = authUser(request)
    if (!user) return unauthorized()
    const body = (await request.json()) as {
      email?: string
      public_slug?: string | null
      preferred_currency?: string
    }
    const dbUser = db.getUser()
    db.setUser({
      ...dbUser,
      ...(body.email ? { email: body.email } : {}),
      ...(body.public_slug !== undefined
        ? { public_slug: body.public_slug?.trim() ? body.public_slug.trim().toLowerCase() : null }
        : {}),
      ...(body.preferred_currency
        ? { preferred_currency: body.preferred_currency.toUpperCase() }
        : {}),
    })
    return HttpResponse.json(db.publicUser())
  }),

  http.post('/api/v1/auth/2fa/setup', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const secret = 'JBSWY3DPEHPK3PXP'
    const dbUser = db.getUser()
    db.setUser({ ...dbUser, totp_secret: secret })
    return HttpResponse.json({
      secret,
      otpauth_uri: `otpauth://totp/Vortex:${encodeURIComponent(dbUser.email)}?secret=${secret}&issuer=Vortex`,
    })
  }),

  http.post('/api/v1/auth/2fa/verify', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { code?: string }
    if (!body.code || body.code.length < 6) return bad('Invalid TOTP', 'invalid_totp')
    const dbUser = db.getUser()
    db.setUser({ ...dbUser, is_2fa_enabled: true })
    return HttpResponse.json(db.publicUser())
  }),

  http.post('/api/v1/auth/2fa/disable', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { code?: string }
    if (!body.code || body.code.length < 6) return bad('Invalid TOTP', 'invalid_totp')
    const dbUser = db.getUser()
    db.setUser({ ...dbUser, is_2fa_enabled: false, totp_secret: null })
    return HttpResponse.json(db.publicUser())
  }),

  http.post('/api/v1/auth/password', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as {
      current_password?: string
      new_password?: string
    }
    const dbUser = db.getUser()
    if (body.current_password !== dbUser.password) {
      return bad('Current password is incorrect', 'invalid_password')
    }
    if (!body.new_password || body.new_password.length < 8) {
      return bad('New password must be at least 8 characters', 'weak_password')
    }
    db.setUser({ ...dbUser, password: body.new_password })
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/v1/hosts', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json([...db.hosts].sort((a, b) => a.sort_order - b.sort_order))
  }),

  http.patch('/api/v1/hosts/reorder', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { host_ids?: string[] }
    const ids = body.host_ids ?? []
    const byId = new Map(db.hosts.map((h) => [h.id, h]))
    const next: typeof db.hosts = []
    for (let i = 0; i < ids.length; i++) {
      const h = byId.get(ids[i]!)
      if (!h) return bad('Host not found', 'host_not_found', 404)
      h.sort_order = i
      h.updated_at = new Date().toISOString()
      next.push(h)
    }
    for (const h of db.hosts) {
      if (!ids.includes(h.id)) next.push(h)
    }
    db.hosts.length = 0
    db.hosts.push(...next)
    return HttpResponse.json([...db.hosts].sort((a, b) => a.sort_order - b.sort_order))
  }),

  http.post('/api/v1/hosts', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as CreateHostPayload
    const ip = body.ip_address ?? null
    const host = {
      id: db.uid('hst'),
      name: body.name,
      ip_address: ip,
      port: body.port,
      username: body.username,
      notes: body.notes ?? null,
      country_code: mockCountryFromIp(ip),
      billing_enabled: body.billing_enabled ?? false,
      billing_cycle: body.billing_cycle ?? null,
      billing_custom_days: body.billing_custom_days ?? null,
      billing_renewal_at: body.billing_renewal_at ?? null,
      billing_amount:
        body.billing_amount != null ? String(body.billing_amount) : null,
      billing_currency: body.billing_currency ?? null,
      billing_auto_renew: body.billing_auto_renew ?? true,
      billing_notes: body.billing_notes ?? null,
      is_hidden: body.is_hidden ?? false,
      sort_order: db.hosts.length,
      is_proxy_enabled: body.is_proxy_enabled ?? false,
      tags: [],
      agent: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.hosts.push(host)
    return HttpResponse.json(host, { status: 201 })
  }),

  http.patch('/api/v1/hosts/:id', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    const body = (await request.json()) as UpdateHostPayload
    const ip = body.ip_address === undefined ? host.ip_address : body.ip_address
    Object.assign(host, {
      name: body.name ?? host.name,
      ip_address: ip,
      port: body.port ?? host.port,
      username: body.username ?? host.username,
      notes: body.notes === undefined ? host.notes : body.notes,
      country_code: mockCountryFromIp(ip),
      is_hidden: body.is_hidden === undefined ? host.is_hidden : body.is_hidden,
      billing_enabled:
        body.billing_enabled === undefined ? host.billing_enabled : body.billing_enabled,
      billing_cycle:
        body.billing_cycle === undefined ? host.billing_cycle : body.billing_cycle,
      billing_custom_days:
        body.billing_custom_days === undefined
          ? host.billing_custom_days
          : body.billing_custom_days,
      billing_renewal_at:
        body.billing_renewal_at === undefined
          ? host.billing_renewal_at
          : body.billing_renewal_at,
      billing_amount:
        body.billing_amount === undefined
          ? host.billing_amount
          : body.billing_amount != null
            ? String(body.billing_amount)
            : null,
      billing_currency:
        body.billing_currency === undefined
          ? host.billing_currency
          : body.billing_currency,
      billing_auto_renew:
        body.billing_auto_renew === undefined
          ? host.billing_auto_renew
          : body.billing_auto_renew,
      billing_notes:
        body.billing_notes === undefined ? host.billing_notes : body.billing_notes,
      updated_at: new Date().toISOString(),
    })
    return HttpResponse.json(host)
  }),

  http.patch('/api/v1/hosts/:id/proxy', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    const body = (await request.json()) as { is_proxy_enabled?: boolean }
    host.is_proxy_enabled = Boolean(body.is_proxy_enabled)
    host.updated_at = new Date().toISOString()
    return HttpResponse.json(host)
  }),

  http.patch('/api/v1/hosts/:id/hidden', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    const body = (await request.json()) as { is_hidden?: boolean }
    host.is_hidden = Boolean(body.is_hidden)
    host.updated_at = new Date().toISOString()
    return HttpResponse.json(host)
  }),

  http.delete('/api/v1/hosts/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.hosts.findIndex((h) => h.id === params.id)
    if (idx < 0) return bad('Host not found', 'host_not_found', 404)
    db.hosts.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.put('/api/v1/hosts/:id/tags', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    const body = (await request.json()) as { tag_ids?: string[] }
    const ids = body.tag_ids ?? []
    host.tags = db.resolveTags(ids)
    return HttpResponse.json(host)
  }),

  http.post('/api/v1/hosts/:id/tags/:tagId', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    const tag = db.tags.find((t) => t.id === params.tagId)
    if (!tag) return bad('Tag not found', 'tag_not_found', 404)
    if (!host.tags.some((t) => t.id === tag.id)) host.tags.push(tag)
    return HttpResponse.json(host)
  }),

  http.delete('/api/v1/hosts/:id/tags/:tagId', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    host.tags = host.tags.filter((t) => t.id !== params.tagId)
    return HttpResponse.json(host)
  }),

  http.get('/api/v1/hosts/:id/telemetry', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const snap = db.bumpTelemetry(String(params.id)) ?? db.telemetryByHost[String(params.id)]
    if (!snap) {
      return HttpResponse.json(
        { error: { code: 'telemetry_missing', message: 'No telemetry available' } },
        { status: 404 },
      )
    }
    return HttpResponse.json(snap)
  }),

  http.get('/api/v1/tags', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.tags)
  }),

  http.post('/api/v1/tags', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { name?: string; color?: string }
    if (!body.name || !body.color) return bad('name and color required')
    const tag = {
      id: db.uid('tag'),
      name: body.name,
      color: body.color,
      created_at: new Date().toISOString(),
    }
    db.tags.push(tag)
    return HttpResponse.json(tag, { status: 201 })
  }),

  http.delete('/api/v1/tags/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.tags.findIndex((t) => t.id === params.id)
    if (idx < 0) return bad('Tag not found', 'tag_not_found', 404)
    db.tags.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.post('/api/v1/hosts/:hostId/agents', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.hostId))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    if (host.agent) return bad('Agent exists', 'agent_exists', 409)
    const secret = `ags_${crypto.randomUUID().slice(0, 16)}`
    host.agent = {
      id: db.uid('agt'),
      host_id: host.id,
      version: null,
      is_online: false,
      last_seen_at: null,
    }
    return HttpResponse.json(
      {
        id: host.agent.id,
        host_id: host.id,
        secret,
        version: null,
        is_online: false,
      },
      { status: 201 },
    )
  }),

  http.post('/api/v1/hosts/:hostId/agents/rotate', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.hostId))
    if (!host?.agent) return bad('Agent not found', 'agent_not_found', 404)
    const secret = `ags_${crypto.randomUUID().slice(0, 16)}`
    return HttpResponse.json({
      id: host.agent.id,
      host_id: host.id,
      secret,
    })
  }),

  http.get('/api/v1/hosts/:hostId/tasks', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.tasks.filter((t) => t.host_id === params.hostId))
  }),

  http.post('/api/v1/hosts/:hostId/tasks', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as CreateTaskPayload
    const task = {
      id: db.uid('tsk'),
      host_id: String(params.hostId),
      name: body.name,
      command: body.command,
      cron_expr: body.cron_expr ?? null,
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.tasks.push(task)
    return HttpResponse.json(task, { status: 201 })
  }),

  http.patch('/api/v1/tasks/:id', async ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const task = db.tasks.find((t) => t.id === params.id)
    if (!task) return bad('Task not found', 'task_not_found', 404)
    const body = (await request.json()) as UpdateTaskPayload
    Object.assign(task, {
      name: body.name ?? task.name,
      command: body.command ?? task.command,
      cron_expr: body.cron_expr === undefined ? task.cron_expr : body.cron_expr,
      is_active: body.is_active ?? task.is_active,
      updated_at: new Date().toISOString(),
    })
    return HttpResponse.json(task)
  }),

  http.delete('/api/v1/tasks/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.tasks.findIndex((t) => t.id === params.id)
    if (idx < 0) return bad('Task not found', 'task_not_found', 404)
    db.tasks.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/v1/tasks/:id/logs', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.taskLogs.filter((l) => l.task_id === params.id))
  }),

  http.post('/api/v1/tasks/:id/run', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const task = db.tasks.find((t) => t.id === params.id)
    if (!task) return bad('Task not found', 'task_not_found', 404)
    return HttpResponse.json(task)
  }),

  http.get('/api/v1/api-keys', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json(db.apiKeys)
  }),

  http.post('/api/v1/api-keys', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as { name?: string }
    if (!body.name) return bad('name required')
    const key = `vxk_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    const row = {
      id: db.uid('key'),
      name: body.name,
      key_prefix: key.slice(0, 12),
      expires_at: null,
      created_at: new Date().toISOString(),
    }
    db.apiKeys.push(row)
    return HttpResponse.json({ ...row, key }, { status: 201 })
  }),

  http.delete('/api/v1/api-keys/:id', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const idx = db.apiKeys.findIndex((k) => k.id === params.id)
    if (idx < 0) return bad('Key not found', 'key_not_found', 404)
    db.apiKeys.splice(idx, 1)
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get('/api/v1/public/u/:slug', ({ params }) => {
    const slug = String(params.slug).toLowerCase()
    const u = db.getUser()
    if (!u.public_slug || u.public_slug !== slug || !u.is_active) {
      return bad('Status page not found', 'status_not_found', 404)
    }
    const hosts = db.hosts
      .filter((h) => !h.is_hidden)
      .map((h) => {
        const t = db.telemetryByHost[h.id]
        return {
          id: h.id,
          name: h.name,
          country_code: h.country_code,
          agent_online: Boolean(h.agent?.is_online),
          telemetry: t
            ? {
                cpu_percent: t.cpu_percent,
                ram_percent: t.ram_percent,
                net_bytes_sent: t.net_bytes_sent,
                net_bytes_recv: t.net_bytes_recv,
                uptime_seconds: t.uptime_seconds,
                collected_at: t.collected_at,
              }
            : null,
        }
      })
    return HttpResponse.json({ slug: u.public_slug, hosts })
  }),

  http.get('/api/v1/billing/calendar', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year'))
    const month = Number(url.searchParams.get('month'))
    const days = db.hosts
      .filter((h) => h.billing_enabled && h.billing_renewal_at)
      .filter((h) => {
        const d = h.billing_renewal_at!
        return d.startsWith(`${year}-${String(month).padStart(2, '0')}`)
      })
      .map((h) => ({
        date: h.billing_renewal_at!,
        hosts: [
          {
            id: h.id,
            name: h.name,
            billing_amount: h.billing_amount,
            billing_currency: h.billing_currency,
            amount_converted: h.billing_amount,
            country_code: h.country_code,
            is_next: true,
            cycle: h.billing_cycle,
          },
        ],
      }))
    return HttpResponse.json({
      year,
      month,
      currency: db.getUser().preferred_currency,
      days,
    })
  }),

  http.get('/api/v1/billing/summary', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const items = db.hosts
      .filter((h) => h.billing_enabled && h.billing_amount)
      .map((h) => ({
        host_id: h.id,
        host_name: h.name,
        amount: h.billing_amount!,
        currency: h.billing_currency ?? 'USD',
        amount_converted: h.billing_amount,
        renewal_at: h.billing_renewal_at,
        cycle: h.billing_cycle,
      }))
    const total = items.reduce((acc, i) => acc + Number(i.amount), 0)
    const url = new URL(request.url)
    return HttpResponse.json({
      currency: db.getUser().preferred_currency,
      from_date: url.searchParams.get('from'),
      to_date: url.searchParams.get('to'),
      total: total.toFixed(2),
      items,
      skipped: [],
    })
  }),

  http.post('/api/v1/hosts/:id/billing/advance', ({ request, params }) => {
    if (!authUser(request)) return unauthorized()
    const host = db.findHost(String(params.id))
    if (!host) return bad('Host not found', 'host_not_found', 404)
    if (!host.billing_renewal_at) return bad('Billing not configured', 'billing_not_configured')
    const d = new Date(host.billing_renewal_at)
    d.setMonth(d.getMonth() + 1)
    host.billing_renewal_at = d.toISOString().slice(0, 10)
    return HttpResponse.json(host)
  }),

  http.get('/api/v1/users/me/notification-settings', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json({ ...defaultNotificationSettings })
  }),

  http.patch('/api/v1/users/me/notification-settings', async ({ request }) => {
    if (!authUser(request)) return unauthorized()
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...defaultNotificationSettings, ...body })
  }),

  http.get('/api/v1/users/me/telegram', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json({
      linked: false,
      chat_id: null,
      linked_at: null,
      bot_username: 'VortexSSHBot',
    })
  }),

  http.post('/api/v1/users/me/telegram/link', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json({
      code: 'deadbeef',
      deep_link: 'https://t.me/VortexSSHBot?start=deadbeef',
      tg_link: 'tg://resolve?domain=VortexSSHBot&start=deadbeef',
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      bot_username: 'VortexSSHBot',
    })
  }),

  http.delete('/api/v1/users/me/telegram', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/notifications', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return HttpResponse.json([])
  }),

  http.post('/api/v1/notifications/read-all', ({ request }) => {
    if (!authUser(request)) return unauthorized()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/health', () => HttpResponse.json({ status: 'ok' })),
]
