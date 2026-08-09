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
    month: 'long',
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
    <div className="rounded-md border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="font-mono text-xs text-muted hover:text-neon"
          onClick={() =>
            setCursor((c) => {
              const m = c.month - 1
              return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m }
            })
          }
        >
          ←
        </button>
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Energy · {unit}
          </div>
          <div className="text-sm text-fg-strong">{monthLabel}</div>
        </div>
        <button
          type="button"
          className="font-mono text-xs text-muted hover:text-neon"
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

      <div className="mb-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div>
          <div className="text-muted">Today</div>
          <div className="text-neon">
            {todayVal == null ? '—' : `${todayVal.toFixed(2)} ${unit}`}
          </div>
        </div>
        <div>
          <div className="text-muted">Month</div>
          <div className="text-neon">{monthTotal.toFixed(2)} {unit}</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div
            key={d}
            className="text-center font-mono text-[9px] uppercase text-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((c) => {
          if (c.day == null) return <div key={c.key} />
          const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
          const val = byDay.get(key)
          const intensity = val == null ? 0 : Math.min(1, val / max)
          return (
            <div
              key={c.key}
              title={val == null ? key : `${key}: ${val.toFixed(3)} ${unit}`}
              className="flex aspect-square flex-col items-center justify-center rounded border border-border/60 font-mono text-[9px]"
              style={{
                background:
                  val == null
                    ? 'transparent'
                    : `rgba(57, 255, 20, ${0.08 + intensity * 0.45})`,
              }}
            >
              <span className="text-dim">{c.day}</span>
              {val != null ? (
                <span className="text-[8px] text-neon">{val < 10 ? val.toFixed(1) : Math.round(val)}</span>
              ) : null}
            </div>
          )
        })}
      </div>
      {query.isLoading ? (
        <p className="mt-2 font-mono text-[10px] text-muted">loading calendar…</p>
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
