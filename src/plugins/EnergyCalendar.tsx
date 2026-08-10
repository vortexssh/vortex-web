import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pluginsApi } from '@/services/pluginsApi'

function monthBounds(year: number, month: number): { from: string; to: string; days: number } {
  const days = new Date(year, month + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(days)}`,
    days,
  }
}

export function EnergyCalendar({
  installId,
  hostId,
  metric = 'energy_kwh',
  unit = 'kWh',
}: {
  installId: string
  hostId: string
  metric?: string
  unit?: string
}) {
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const bounds = useMemo(
    () => monthBounds(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  const query = useQuery({
    queryKey: ['plugins', 'daily', installId, hostId, metric, bounds.from, bounds.to],
    queryFn: () =>
      pluginsApi.dailyMetrics(installId, {
        hostId,
        metric,
        from: bounds.from,
        to: bounds.to,
      }),
    staleTime: 30_000,
  })

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of query.data?.samples ?? []) {
      map.set(s.day, s.value)
    }
    return map
  }, [query.data])

  const max = useMemo(() => {
    let m = 0
    for (const v of byDay.values()) m = Math.max(m, v)
    return m || 1
  }, [byDay])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  })

  const startWeekday = new Date(cursor.year, cursor.month, 1).getDay() // 0 Sun
  const cells: Array<{ day: number | null; key: string }> = []
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, key: `e${i}` })
  for (let d = 1; d <= bounds.days; d++) cells.push({ day: d, key: `d${d}` })

  const monthTotal = [...byDay.values()].reduce((a, b) => a + b, 0)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayVal =
    cursor.year === now.getFullYear() && cursor.month === now.getMonth()
      ? byDay.get(todayStr)
      : undefined

  return (
    <div className="w-full max-w-[220px] rounded border border-border bg-panel p-2">
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <button
          type="button"
          className="px-1 font-mono text-[10px] text-muted hover:text-neon"
          onClick={() =>
            setCursor((c) => {
              const m = c.month - 1
              return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m }
            })
          }
        >
          ←
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate font-mono text-[9px] uppercase tracking-wider text-muted">
            Energy · {unit}
          </div>
          <div className="truncate text-[11px] text-fg-strong">{monthLabel}</div>
        </div>
        <button
          type="button"
          className="px-1 font-mono text-[10px] text-muted hover:text-neon"
          onClick={() =>
            setCursor((c) => {
              const m = c.month + 1
              return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m }
            })
          }
        >
          →
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-2 gap-1 font-mono text-[10px]">
        <div>
          <div className="text-muted">Today</div>
          <div className="text-neon">
            {todayVal == null ? '—' : todayVal.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-muted">Month</div>
          <div className="text-neon">{monthTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div
            key={`${d}${i}`}
            className="text-center font-mono text-[8px] uppercase text-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((c) => {
          if (c.day == null) return <div key={c.key} className="h-5" />
          const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
          const val = byDay.get(key)
          const intensity = val == null ? 0 : Math.min(1, val / max)
          return (
            <div
              key={c.key}
              title={val == null ? key : `${key}: ${val.toFixed(3)} ${unit}`}
              className="flex h-5 items-center justify-center rounded-[2px] border border-border/50 font-mono text-[8px] leading-none"
              style={{
                background:
                  val == null
                    ? 'transparent'
                    : `rgba(57, 255, 20, ${0.08 + intensity * 0.45})`,
              }}
            >
              <span className="text-dim">{c.day}</span>
            </div>
          )
        })}
      </div>
      {query.isLoading ? (
        <p className="mt-1 font-mono text-[9px] text-muted">loading…</p>
      ) : null}
      {query.isError ? (
        <p className="mt-1 font-mono text-[9px] text-danger">calendar failed</p>
      ) : null}
    </div>
  )
}

/** Resolve HA power install id from ui-bundle installs. */
export function findHaPowerInstallId(
  installs: Array<{ id: string; plugin_id: string; status: string }> | undefined,
): string | null {
  const row = (installs ?? []).find(
    (i) => i.plugin_id === 'com.vortex.ha_power' && i.status === 'active',
  )
  return row?.id ?? null
}

export function hostHasPluginBinding(
  installs:
    | Array<{
        id: string
        plugin_id?: string
        host_bindings?: Array<{ host_id: string }>
      }>
    | undefined,
  installId: string,
  hostId: string,
): boolean {
  const inst = (installs ?? []).find((i) => i.id === installId)
  return Boolean(inst?.host_bindings?.some((b) => b.host_id === hostId))
}

/** HA Power (and any contrib with requires_host_binding) only on bound hosts. */
export function contributionAppliesToHost(
  contrib: { install_id: string; plugin_id?: string; requires_host_binding?: boolean },
  installs:
    | Array<{
        id: string
        plugin_id?: string
        host_bindings?: Array<{ host_id: string }>
      }>
    | undefined,
  hostId: string,
): boolean {
  const needsBinding =
    contrib.requires_host_binding === true || contrib.plugin_id === 'com.vortex.ha_power'
  if (!needsBinding) return true
  return hostHasPluginBinding(installs, contrib.install_id, hostId)
}
