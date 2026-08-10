import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/services/billingApi'
import type { BillingHostBrief } from '@/types'
import { countryFlag } from '@/lib/countryFlag'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/services/apiClient'
import { toast } from '@/components/ui/Toast'

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function startWeekday(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return (d + 6) % 7
}

function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function BillingPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedPayerId, setSelectedPayerId] = useState<string>('')
  const [newPayerName, setNewPayerName] = useState('')
  const today = todayIso()

  const payerFilter = selectedPayerId || undefined

  const payersQuery = useQuery({
    queryKey: ['billing', 'payers'],
    queryFn: () => billingApi.listPayers(),
  })

  const payerDetailQuery = useQuery({
    queryKey: ['billing', 'payers', selectedPayerId],
    queryFn: () => billingApi.getPayer(selectedPayerId),
    enabled: Boolean(selectedPayerId),
  })

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`

  const calendarQuery = useQuery({
    queryKey: ['billing', 'calendar', year, month, selectedPayerId],
    queryFn: () => billingApi.calendar(year, month, payerFilter),
  })
  const summaryQuery = useQuery({
    queryKey: ['billing', 'summary', from, to, selectedPayerId],
    queryFn: () => billingApi.summary(from, to, payerFilter),
  })

  const createPayerMutation = useMutation({
    mutationFn: (name: string) => billingApi.createPayer({ name }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['billing', 'payers'] })
      setSelectedPayerId(p.id)
      setNewPayerName('')
      toast(`Payer «${p.name}» created`, 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Could not create payer', 'error'),
  })

  const byDate = useMemo(() => {
    const map = new Map<string, BillingHostBrief[]>()
    for (const day of calendarQuery.data?.days ?? []) {
      map.set(day.date, day.hosts)
    }
    return map
  }, [calendarQuery.data])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setYear(y)
    setMonth(m)
    setSelectedDay(null)
  }

  const totalDays = daysInMonth(year, month)
  const pad = startWeekday(year, month)
  const cells: Array<{ day: number | null; date: string | null }> = []
  for (let i = 0; i < pad; i++) cells.push({ day: null, date: null })
  for (let d = 1; d <= totalDays; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date })
  }

  const selectedHosts = selectedDay ? (byDate.get(selectedDay) ?? []) : []
  const currency = summaryQuery.data?.currency ?? calendarQuery.data?.currency ?? 'USD'
  const activePayerName =
    selectedPayerId
      ? (payersQuery.data?.find((p) => p.id === selectedPayerId)?.name ??
        payerDetailQuery.data?.name)
      : null

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">Payer</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm min-w-[12rem]">
            <span className="text-xs uppercase tracking-wider text-muted">Filter by payer</span>
            <select
              className="rounded-md border border-border bg-void px-3 py-2 font-mono text-sm text-fg-strong"
              value={selectedPayerId}
              onChange={(e) => {
                setSelectedPayerId(e.target.value)
                setSelectedDay(null)
              }}
            >
              <option value="">All payers</option>
              {(payersQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.host_count})
                </option>
              ))}
            </select>
          </label>
          <Input
            label="New payer"
            value={newPayerName}
            onChange={(e) => setNewPayerName(e.target.value)}
            placeholder="Company / person"
            className="max-w-xs"
          />
          <Button
            variant="outline"
            disabled={!newPayerName.trim() || createPayerMutation.isPending}
            onClick={() => createPayerMutation.mutate(newPayerName.trim())}
          >
            Add payer
          </Button>
        </div>
        {selectedPayerId && payerDetailQuery.data ? (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg-strong">
                {payerDetailQuery.data.name}
              </span>
              <Badge tone="muted">{payerDetailQuery.data.host_count} hosts</Badge>
            </div>
            {payerDetailQuery.data.notes ? (
              <p className="mb-3 text-sm text-dim">{payerDetailQuery.data.notes}</p>
            ) : null}
            {payerDetailQuery.data.hosts.length === 0 ? (
              <p className="font-mono text-xs text-muted">No hosts linked — assign in host Edit.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {payerDetailQuery.data.hosts.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-void px-3 py-2 font-mono text-xs"
                  >
                    <span className="flex items-center gap-2 text-fg-strong">
                      <span>{countryFlag(h.country_code)}</span>
                      {h.name}
                    </span>
                    <span className="text-muted">
                      {h.billing_enabled
                        ? `${h.billing_amount ?? '—'} ${h.billing_currency ?? ''} · due ${h.billing_renewal_at ?? '—'}`
                        : 'billing off'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted">Spend</h2>
          <p className="mt-1 text-2xl font-semibold text-fg-strong">
            {summaryQuery.data?.total ?? '—'}{' '}
            <span className="font-mono text-base text-neon">{currency}</span>
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {activePayerName ? `Payer: ${activePayerName} · ` : ''}
            Next renewals in {monthLabel(year, month)} · projected periods shown dimmed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => shiftMonth(-1)}>
            ←
          </Button>
          <span className="min-w-[10rem] text-center font-mono text-sm text-fg-strong">
            {monthLabel(year, month)}
          </span>
          <Button variant="ghost" onClick={() => shiftMonth(1)}>
            →
          </Button>
        </div>
      </div>

      {(summaryQuery.data?.skipped.length ?? 0) > 0 ? (
        <p className="font-mono text-xs text-warn">
          Skipped FX: {summaryQuery.data!.skipped.join('; ')}
        </p>
      ) : null}

      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.date) {
            return <div key={`pad-${idx}`} className="min-h-16 rounded-md bg-transparent" />
          }
          const hosts = byDate.get(cell.date) ?? []
          const hasNext = hosts.some((h) => h.is_next)
          const hasProjectedOnly = hosts.length > 0 && !hasNext
          const selected = selectedDay === cell.date
          const isToday = cell.date === today
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelectedDay(cell.date)}
              className={`relative min-h-16 rounded-md border p-1.5 text-left transition-colors ${
                selected
                  ? 'border-neon/50 bg-neon/10'
                  : hasNext
                    ? 'border-border-active bg-panel hover:border-neon/40'
                    : hasProjectedOnly
                      ? 'border-border/60 bg-surface/40 hover:border-border'
                      : 'border-border bg-surface hover:border-border-active'
              } ${isToday ? 'ring-1 ring-neon/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`font-mono text-xs ${
                    isToday ? 'font-semibold text-neon' : 'text-dim'
                  }`}
                >
                  {cell.day}
                </span>
                {isToday ? (
                  <span className="font-mono text-[8px] uppercase tracking-wider text-neon">
                    today
                  </span>
                ) : null}
              </div>
              {hosts.length ? (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {hosts.slice(0, 3).map((h) => (
                    <span
                      key={`${h.id}-${h.is_next ? 'n' : 'p'}`}
                      title={`${h.name}${h.payer_name ? ` · ${h.payer_name}` : ''}${h.is_next ? '' : ' (projected)'}`}
                      className={`text-sm leading-none ${h.is_next ? '' : 'opacity-35 grayscale'}`}
                    >
                      {countryFlag(h.country_code)}
                    </span>
                  ))}
                  {hosts.length > 3 ? (
                    <span className="font-mono text-[10px] text-muted">+{hosts.length - 3}</span>
                  ) : null}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="font-mono text-[10px] text-muted">
        Bright flags = next renewal · dimmed = projected future period
      </p>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
          {selectedDay
            ? selectedDay === today
              ? `Today · ${selectedDay}`
              : `Due ${selectedDay}`
            : 'Select a day'}
        </h3>
        {!selectedDay ? (
          <p className="text-sm text-dim">Click a marked day to see renewing hosts.</p>
        ) : selectedHosts.length === 0 ? (
          <p className="text-sm text-dim">No renewals this day.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedHosts.map((h) => (
              <li
                key={`${h.id}-${h.is_next ? 'next' : 'proj'}`}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                  h.is_next
                    ? 'border-border bg-void'
                    : 'border-border/50 bg-void/40 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-base ${h.is_next ? '' : 'grayscale'}`}>
                    {countryFlag(h.country_code)}
                  </span>
                  <div>
                    <span className="text-sm text-fg-strong">{h.name}</span>
                    {h.payer_name ? (
                      <span className="ml-2 font-mono text-[10px] text-muted">
                        {h.payer_name}
                      </span>
                    ) : null}
                    {!h.is_next ? (
                      <span className="ml-2 font-mono text-[10px] uppercase text-muted">
                        projected
                      </span>
                    ) : null}
                  </div>
                </div>
                <Badge tone={h.is_next ? 'neon' : 'muted'}>
                  {h.billing_amount} {h.billing_currency}
                  {h.amount_converted != null
                    ? ` · ${h.amount_converted} ${currency}`
                    : ''}
                  {h.cycle ? ` / ${h.cycle}` : ''}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summaryQuery.data && summaryQuery.data.items.length > 0 ? (
        <section className="rounded-lg border border-border bg-panel p-4">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
            Next renewals this month
          </h3>
          <ul className="flex flex-col gap-1">
            {summaryQuery.data.items.map((item) => (
              <li
                key={item.host_id}
                className="flex justify-between gap-2 font-mono text-xs text-dim"
              >
                <span>{item.host_name}</span>
                <span>
                  {item.amount} {item.currency}
                  {item.amount_converted != null
                    ? ` → ${item.amount_converted} ${currency}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
