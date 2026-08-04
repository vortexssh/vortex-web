import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/services/publicApi'
import { countryFlag } from '@/lib/countryFlag'
import { Badge } from '@/components/ui/Badge'
import type { PublicHost } from '@/types'

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

function HostCard({ host }: { host: PublicHost }) {
  const t = host.telemetry
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none" title={host.country_code ?? undefined}>
              {countryFlag(host.country_code)}
            </span>
            <h2 className="truncate font-mono text-sm text-white">{host.name}</h2>
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
    </article>
  )
}

/** Standalone public fleet status — no app chrome, no IPs, safe to proxy_pass. */
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
    <div className="min-h-full bg-void px-4 py-8 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="border-b border-border pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Vortex status
          </p>
          <h1 className="mt-1 font-mono text-xl text-neon text-glow">
            {slug || '—'}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted">
            live telemetry · refresh 5s
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
