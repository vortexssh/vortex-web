import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hostsApi } from '@/services/hostsApi'
import { useTelemetrySocket } from '@/hooks/useTelemetrySocket'
import { MetricChart } from './MetricChart'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function DashboardPage() {
  const hostsQuery = useQuery({ queryKey: ['hosts'], queryFn: () => hostsApi.list() })
  const hosts = hostsQuery.data ?? []
  const onlineHosts = hosts.filter((h) => h.agent?.is_online)
  const [hostId, setHostId] = useState<string | null>(null)
  const [hours, setHours] = useState(6)

  const selectedId = hostId ?? onlineHosts[0]?.id ?? hosts[0]?.id ?? null
  const selected = hosts.find((h) => h.id === selectedId) ?? null

  const { points, status, reconnect, isLoading } = useTelemetrySocket({
    hostId: selectedId,
    hours,
    enabled: Boolean(selected?.agent),
  })

  const stats = useMemo(() => {
    const last = points.at(-1)
    return {
      online: onlineHosts.length,
      total: hosts.length,
      cpu: last?.cpu_percent,
      ram: last?.ram_percent,
      rx: last?.net_rx_mbps,
      uptime: last?.uptime_seconds ?? 0,
    }
  }, [points, onlineHosts.length, hosts.length])

  if (!hostsQuery.isLoading && hosts.length === 0) {
    return (
      <EmptyState title="No hosts" body="Add a host in Host Manager to start collecting telemetry." />
    )
  }

  if (selected && !selected.agent) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <HostPicker
          hosts={hosts}
          selectedId={selectedId}
          onChange={setHostId}
          hours={hours}
          onHours={setHours}
        />
        <EmptyState
          title="No agent on this host"
          body="Install the Vortex Agent to stream CPU, RAM, network and uptime."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <HostPicker
        hosts={hosts}
        selectedId={selectedId}
        onChange={setHostId}
        hours={hours}
        onHours={setHours}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status === 'open' ? 'neon' : status === 'connecting' ? 'warn' : 'danger'}>
          stream · {status}
        </Badge>
        {status !== 'open' ? (
          <Button variant="outline" className="!text-xs" onClick={reconnect}>
            Reconnect
          </Button>
        ) : null}
        {selected?.agent && !selected.agent.is_online ? (
          <Badge tone="warn">agent offline</Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Online hosts', value: `${stats.online}/${stats.total}` },
          {
            label: 'CPU',
            value: stats.cpu === undefined ? '—' : `${stats.cpu.toFixed(0)}%`,
          },
          {
            label: 'RAM',
            value: stats.ram === undefined ? '—' : `${stats.ram.toFixed(0)}%`,
          },
          { label: 'Uptime', value: formatUptime(stats.uptime) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-panel px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{stat.label}</div>
            <div className="mt-1 font-mono text-xl text-neon text-glow">{stat.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="font-mono text-xs text-muted">Loading history…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricChart title="CPU load" unit="%" dataKey="cpu_percent" points={points} />
          <MetricChart title="Memory" unit="%" dataKey="ram_percent" points={points} />
          <MetricChart
            title="Network RX"
            unit=" Mbps"
            dataKey="net_rx_mbps"
            points={points}
            color="#22c55e"
          />
          <MetricChart
            title="Network TX"
            unit=" Mbps"
            dataKey="net_tx_mbps"
            points={points}
            color="#86efac"
          />
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Fleet
        </div>
        <ul className="divide-y divide-border/70">
          {hosts.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="text-white">{h.name}</div>
                <div className="font-mono text-[11px] text-muted">
                  {h.ip_address ?? 'NAT'} · proxy {h.is_proxy_enabled ? 'ON' : 'OFF'}
                </div>
              </div>
              <Badge tone={h.agent?.is_online ? 'neon' : 'muted'}>
                {h.agent?.is_online ? 'online' : h.agent ? 'offline' : 'no agent'}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function HostPicker({
  hosts,
  selectedId,
  onChange,
  hours,
  onHours,
}: {
  hosts: { id: string; name: string }[]
  selectedId: string | null
  onChange: (id: string) => void
  hours: number
  onHours: (h: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className="rounded-md border border-border bg-panel px-3 py-1.5 font-mono text-xs text-dim"
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        {[1, 6, 24].map((h) => (
          <Button
            key={h}
            variant={hours === h ? 'primary' : 'outline'}
            className="!text-xs"
            onClick={() => onHours(h)}
          >
            {h}h
          </Button>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-panel p-8">
      <h2 className="font-mono text-sm uppercase tracking-wider text-neon">{title}</h2>
      <p className="mt-2 text-sm text-dim">{body}</p>
    </div>
  )
}
