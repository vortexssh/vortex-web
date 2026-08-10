import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { pluginsApi } from '@/services/pluginsApi'
import { toast } from '@/components/ui/Toast'
import { ApiError } from '@/services/apiClient'
import { evalCondition, formatValue, resolveBind } from './bindings'
import type { DeclarativeNode, PluginViewContext } from './types'

interface DeclarativeViewProps {
  node: DeclarativeNode | null | undefined
  ctx: PluginViewContext
  installId: string
  hostId?: string
  onStateChange?: () => void
}

export function DeclarativeView({
  node,
  ctx,
  installId,
  hostId,
  onStateChange,
}: DeclarativeViewProps) {
  const [actionResult, setActionResult] = useState<Record<string, unknown> | undefined>()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const mergedCtx = useMemo(
    () => ({ ...ctx, actionResult: actionResult ?? ctx.actionResult }),
    [ctx, actionResult],
  )

  async function runAction(action?: string, params: Record<string, unknown> = {}) {
    if (!action || busyAction) return
    setBusyAction(action)
    try {
      const res = await pluginsApi.rpc(installId, action, params, hostId)
      setActionResult(res.result ?? {})
      onStateChange?.()
      const bound = res.result?.bound_count
      toast(
        typeof bound === 'number'
          ? `Refreshed · ${bound} host${bound === 1 ? '' : 's'}`
          : 'Action completed',
        'success',
      )
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', 'error')
    } finally {
      setBusyAction(null)
    }
  }

  if (!node || typeof node !== 'object') return null
  if (!evalCondition(node.visibleIf, mergedCtx)) return null

  const t = node.type
  const children = node.children ?? []

  if (t === 'stack') {
    return (
      <div className="flex flex-col gap-3">
        {node.title ? <h3 className="text-sm font-medium text-fg-strong">{node.title}</h3> : null}
        {children.map((child, i) => (
          <DeclarativeView
            key={i}
            node={child}
            ctx={mergedCtx}
            installId={installId}
            hostId={hostId}
            onStateChange={onStateChange}
          />
        ))}
      </div>
    )
  }

  if (t === 'grid') {
    const cols = typeof node.columns === 'number' ? node.columns : 2
    return (
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children.map((child, i) => (
          <DeclarativeView
            key={i}
            node={child}
            ctx={mergedCtx}
            installId={installId}
            hostId={hostId}
            onStateChange={onStateChange}
          />
        ))}
      </div>
    )
  }

  if (t === 'panel') {
    return (
      <div className="rounded-md border border-border bg-panel p-3">
        {node.title ? (
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            {node.title}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {children.map((child, i) => (
            <DeclarativeView
              key={i}
              node={child}
              ctx={mergedCtx}
              installId={installId}
              hostId={hostId}
              onStateChange={onStateChange}
            />
          ))}
        </div>
      </div>
    )
  }

  if (t === 'tabs') {
    return (
      <div className="flex flex-col gap-2">
        {children.map((child, i) => (
          <DeclarativeView
            key={i}
            node={child}
            ctx={mergedCtx}
            installId={installId}
            hostId={hostId}
            onStateChange={onStateChange}
          />
        ))}
      </div>
    )
  }

  if (t === 'text' || t === 'markdown') {
    const text =
      (node.bind ? formatValue(resolveBind(node.bind, mergedCtx)) : null) ?? node.text ?? ''
    return <p className="whitespace-pre-wrap text-sm text-dim">{String(text)}</p>
  }

  if (t === 'metric') {
    const value = resolveBind(node.bind, mergedCtx)
    return (
      <div>
        {node.label ? (
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {node.label}
          </div>
        ) : null}
        <div className="font-mono text-lg text-neon">{formatValue(value, node.unit)}</div>
      </div>
    )
  }

  if (t === 'badge') {
    const value = resolveBind(node.bind, mergedCtx)
    return <Badge tone={node.tone === 'warn' ? 'warn' : 'neon'}>{formatValue(value)}</Badge>
  }

  if (t === 'progress') {
    const value = Number(resolveBind(node.bind, mergedCtx) ?? 0)
    const pct = Math.max(0, Math.min(100, value))
    return (
      <div>
        {node.label ? (
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {node.label}
          </div>
        ) : null}
        <div className="h-2 overflow-hidden rounded bg-void">
          <div className="h-full bg-neon/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (t === 'sparkline' || t === 'chart') {
    const raw = resolveBind(node.bind, mergedCtx)
    const points = Array.isArray(raw)
      ? raw.map((v) =>
          typeof v === 'number' ? v : Number((v as { value?: number })?.value ?? 0),
        )
      : []
    return (
      <div>
        {node.label ? (
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {node.label}
          </div>
        ) : null}
        <MiniSparkline points={points} />
      </div>
    )
  }

  if (t === 'table') {
    const rows = resolveBind(node.bind, mergedCtx)
    const list = Array.isArray(rows) ? rows : []
    const cols = Array.isArray(node.columns) ? node.columns : []
    return (
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border font-mono text-[10px] uppercase text-muted">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-1.5">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-dim">
                    {formatValue(
                      typeof row === 'object' && row
                        ? (row as Record<string, unknown>)[c.key]
                        : row,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (t === 'button' || t === 'confirm') {
    const enabled = evalCondition(node.enableIf, mergedCtx)
    const action = node.action
    const thisBusy = Boolean(action && busyAction === action)
    return (
      <Button
        type="button"
        disabled={!enabled || busyAction != null}
        onClick={() => {
          if (t === 'confirm') {
            const ok = window.confirm(node.confirmMessage ?? 'Are you sure?')
            if (!ok) return
          }
          void runAction(action)
        }}
      >
        {thisBusy ? 'Working…' : (node.label ?? 'Run')}
      </Button>
    )
  }

  if (t === 'form') {
    return (
      <SchemaForm
        schema={node.schema ?? {}}
        submitLabel={node.submitLabel ?? 'Save'}
        onSubmit={(values) => void runAction(node.submitAction, values)}
      />
    )
  }

  if (t === 'repeater') {
    const items = resolveBind(node.bind, mergedCtx)
    const list = Array.isArray(items) ? items : []
    if (!node.item) return null
    return (
      <div className="flex flex-col gap-2">
        {list.map((item, i) => (
          <DeclarativeView
            key={i}
            node={node.item}
            ctx={{
              ...mergedCtx,
              pluginState: {
                ...(mergedCtx.pluginState ?? {}),
                item: item as Record<string, unknown>,
              },
            }}
            installId={installId}
            hostId={hostId}
            onStateChange={onStateChange}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px] text-muted">Unsupported widget: {String(t)}</div>
  )
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length === 0) {
    return <div className="font-mono text-[11px] text-muted">no series</div>
  }
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = max - min || 1
  const w = 160
  const h = 36
  const d = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w
      const y = h - ((p - min) / span) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="text-neon">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SchemaForm({
  schema,
  submitLabel,
  onSubmit,
}: {
  schema: Record<string, unknown>
  submitLabel: string
  onSubmit: (values: Record<string, unknown>) => void
}) {
  const properties =
    (schema.properties as Record<string, { type?: string; title?: string }>) ?? {}
  const keys = Object.keys(properties)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, ''])),
  )

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const out: Record<string, unknown> = {}
    for (const k of keys) {
      const propType = properties[k]?.type
      const raw = values[k] ?? ''
      if (propType === 'number' || propType === 'integer') out[k] = raw === '' ? null : Number(raw)
      else if (propType === 'boolean') out[k] = raw === 'true'
      else out[k] = raw
    }
    onSubmit(out)
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      {keys.map((k) => (
        <label key={k} className="flex flex-col gap-1 text-xs text-muted">
          {properties[k]?.title ?? k}
          <Input
            value={values[k] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
          />
        </label>
      ))}
      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

export function SlotOutlet({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
