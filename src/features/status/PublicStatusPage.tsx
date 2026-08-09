import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/services/publicApi'
import { countryFlag } from '@/lib/countryFlag'
import { Badge } from '@/components/ui/Badge'
import type { PublicEnergy, PublicHost } from '@/types'

function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Math.round(n)}%`
}

function Meter({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value == null || Number.isNaN(value) ? null : Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="text-dim">{pct(v)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-void">
        <div
          className="h-full rounded-full bg-neon/80 transition-[width] duration-500"
          style={{ width: v == null ? '0%' : `${v}%` }}
        />
      </div>
    </div>
  )
}

function CompactMonth({ energy }: { energy: PublicEnergy }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  const byDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of energy.calendar) m.set(d.day, d.value)
    return m
  }, [energy.calendar])
  const max = useMemo(() => {
    let v = 0
    for (const x of byDay.values()) v = Math.max(v, x)
    return v || 1
  }, [byDay])

  const cells: Array<number | null> = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
        Energy calendar · {energy.unit}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div>
          <span className="text-muted">Today </span>
          <span className="text-neon">
            {energy.today_kwh == null ? '—' : `${energy.today_kwh.toFixed(2)}`}
          </span>
        </div>
        <div>
          <span className="text-muted">Month </span>
          <span className="text-neon">
            {energy.month_kwh == null ? '—' : `${energy.month_kwh.toFixed(2)}`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const val = byDay.get(key)
          const intensity = val == null ? 0 : Math.min(1, val / max)
          return (
            <div
              key={key}
              title={val == null ? key : `${key}: ${val.toFixed(3)} ${energy.unit}`}
              className="aspect-square rounded-[2px] border border-border/40"
              style={{
                background:
                  val == null
                    ? 'transparent'
                    : `rgba(57, 255, 20, ${0.1 + intensity * 0.5})`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function HostCard({ host }: { host: PublicHost }) {
  const t = host.telemetry
  const billing = host.billing
  const energy = host.energy

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none" title={host.country_code ?? undefined}>
              {countryFlag(host.country_code)}
            </span>
            <h2 className="truncate font-mono text-sm text-fg-strong">{host.name}</h2>
          </div>
        </div>
        <Badge tone={host.agent_online ? 'neon' : 'warn'}>
          {host.agent_online ? 'online' : 'offline'}
        </Badge>
      </div>

      <Meter label="CPU" value={t?.cpu_percent} />
      <Meter label="RAM" value={t?.ram_percent} />

      <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-dim">
        <div>
          <div className="text-muted">Uptime</div>
          <div className="text-neon">{formatUptime(t?.uptime_seconds)}</div>
        </div>
        <div>
          <div className="text-muted">Net RX / TX</div>
          <div>
            {formatBytes(t?.net_bytes_recv)} / {formatBytes(t?.net_bytes_sent)}
          </div>
        </div>
      </div>

      {billing?.enabled ? (
        <div className="rounded-md border border-border/70 bg-void/60 p-2.5">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Billing
          </div>
          <div className="font-mono text-sm text-neon">
            {billing.amount ?? '—'} {billing.currency ?? ''}
            <span className="text-muted"> / {billing.cycle ?? '?'}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-dim">
            <span>due {billing.renewal_at ?? '—'}</span>
            {billing.auto_renew ? <Badge tone="neon">auto-renew</Badge> : null}
          </div>
        </div>
      ) : null}

      {energy ? <CompactMonth energy={energy} /> : null}
    </article>
  )
}

/** Standalone public fleet status — no app chrome, no IPs. */
export function PublicStatusPage() {
  const { slug = '' } = useParams()

  const query = useQuery({
    queryKey: ['public-status', slug],
    queryFn: () => publicApi.getStatus(slug),
    enabled: Boolean(slug),
    refetchInterval: 5_000,
    retry: 1,
  })

  return (
    <div className="min-h-full bg-void px-4 py-8 text-fg-strong">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="border-b border-border pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Vortex public status
          </p>
          <h1 className="mt-1 font-mono text-xl text-neon text-glow">{slug || '—'}</h1>
          <p className="mt-1 font-mono text-[11px] text-muted">
            telemetry · billing · energy · refresh 5s
            {query.isFetching ? ' · updating…' : ''}
          </p>
        </header>

        {query.isError ? (
          <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
            <p className="font-mono text-sm text-warn">Status page not found</p>
          </div>
        ) : null}

        {query.isLoading ? (
          <p className="font-mono text-xs text-muted">loading…</p>
        ) : null}

        {query.data && query.data.hosts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
            <p className="font-mono text-sm text-dim">No public hosts</p>
          </div>
        ) : null}

        {query.data && query.data.hosts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.hosts.map((h) => (
              <HostCard key={h.id} host={h} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
