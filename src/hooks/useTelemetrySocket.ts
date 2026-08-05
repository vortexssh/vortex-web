import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/services/apiClient'
import { telemetryApi } from '@/services/telemetryApi'
import type { TelemetryPoint, TelemetrySnapshot } from '@/types'

interface UseTelemetryOptions {
  hostId: string | null
  enabled?: boolean
  pollIntervalMs?: number
}

const MAX_POINTS = 120

function snapshotsToPoints(snaps: TelemetrySnapshot[]): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  let prev: { recv: number; sent: number; at: number } | null = null

  for (const snap of snaps) {
    const at = snap.collected_at ? Date.parse(snap.collected_at) : Date.now()
    let netRx = 0
    let netTx = 0
    if (
      prev &&
      snap.net_bytes_recv != null &&
      snap.net_bytes_sent != null &&
      Number.isFinite(at)
    ) {
      const dt = Math.max(0.5, (at - prev.at) / 1000)
      netRx = Math.max(0, ((snap.net_bytes_recv - prev.recv) * 8) / dt / 1_000_000)
      netTx = Math.max(0, ((snap.net_bytes_sent - prev.sent) * 8) / dt / 1_000_000)
    }
    if (snap.net_bytes_recv != null && snap.net_bytes_sent != null && Number.isFinite(at)) {
      prev = { recv: snap.net_bytes_recv, sent: snap.net_bytes_sent, at }
    }
    points.push({
      timestamp: snap.collected_at ?? new Date(at).toISOString(),
      cpu_percent: snap.cpu_percent ?? 0,
      ram_percent: snap.ram_percent ?? 0,
      net_rx_mbps: netRx,
      net_tx_mbps: netTx,
      uptime_seconds: snap.uptime_seconds ?? 0,
    })
  }
  return points.slice(-MAX_POINTS)
}

/**
 * Loads Redis history once, then polls the latest snapshot into a rolling chart buffer.
 */
export function useTelemetrySocket({
  hostId,
  enabled = true,
  pollIntervalMs = 5000,
}: UseTelemetryOptions) {
  const [points, setPoints] = useState<TelemetryPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastAbs = useRef<{ recv: number; sent: number; at: number } | null>(null)
  const lastTs = useRef<string | null>(null)

  const appendSnap = useCallback((snap: TelemetrySnapshot) => {
    const ts = snap.collected_at ?? ''
    if (ts && ts === lastTs.current) return
    lastTs.current = ts || null

    const now = snap.collected_at ? Date.parse(snap.collected_at) : Date.now()
    let netRx = 0
    let netTx = 0
    if (
      lastAbs.current &&
      snap.net_bytes_recv != null &&
      snap.net_bytes_sent != null &&
      Number.isFinite(now)
    ) {
      const dt = Math.max(0.5, (now - lastAbs.current.at) / 1000)
      netRx = Math.max(
        0,
        ((snap.net_bytes_recv - lastAbs.current.recv) * 8) / dt / 1_000_000,
      )
      netTx = Math.max(
        0,
        ((snap.net_bytes_sent - lastAbs.current.sent) * 8) / dt / 1_000_000,
      )
    }
    if (snap.net_bytes_recv != null && snap.net_bytes_sent != null && Number.isFinite(now)) {
      lastAbs.current = {
        recv: snap.net_bytes_recv,
        sent: snap.net_bytes_sent,
        at: now,
      }
    }

    const point: TelemetryPoint = {
      timestamp: snap.collected_at ?? new Date().toISOString(),
      cpu_percent: snap.cpu_percent ?? 0,
      ram_percent: snap.ram_percent ?? 0,
      net_rx_mbps: netRx,
      net_tx_mbps: netTx,
      uptime_seconds: snap.uptime_seconds ?? 0,
    }
    setPoints((prev) => [...prev.slice(-(MAX_POINTS - 1)), point])
  }, [])

  const poll = useCallback(async () => {
    if (!hostId) return
    try {
      const snap = await telemetryApi.get(hostId)
      appendSnap(snap)
      setStatus('open')
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus('closed')
        setError('No telemetry yet — waiting for agent')
        return
      }
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Telemetry poll failed')
    }
  }, [hostId, appendSnap])

  useEffect(() => {
    lastAbs.current = null
    lastTs.current = null
    setPoints([])
    setError(null)

    if (!hostId || !enabled) {
      setStatus('closed')
      return
    }

    let cancelled = false
    setStatus('connecting')
    setIsLoading(true)

    void (async () => {
      try {
        const hist = await telemetryApi.history(hostId)
        if (cancelled) return
        const series = snapshotsToPoints(hist)
        setPoints(series)
        const last = hist.length > 0 ? hist[hist.length - 1] : undefined
        if (last) {
          lastTs.current = last.collected_at
          if (last.net_bytes_recv != null && last.net_bytes_sent != null) {
            lastAbs.current = {
              recv: last.net_bytes_recv,
              sent: last.net_bytes_sent,
              at: last.collected_at ? Date.parse(last.collected_at) : Date.now(),
            }
          }
          setStatus('open')
        }
      } catch {
        // History optional — polling still fills the chart.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
      if (!cancelled) await poll()
    })()

    const id = window.setInterval(() => {
      void poll()
    }, pollIntervalMs)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [hostId, enabled, pollIntervalMs, poll])

  return {
    points,
    status,
    reconnect: () => {
      void poll()
    },
    isLoading,
    error,
  }
}
