import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/services/apiClient'
import { telemetryApi } from '@/services/telemetryApi'
import type { TelemetryPoint } from '@/types'

interface UseTelemetryOptions {
  hostId: string | null
  enabled?: boolean
  pollIntervalMs?: number
}

/**
 * Core stores a single Redis snapshot (TTL), not a time series.
 * Web polls GET /hosts/{id}/telemetry and builds a rolling chart buffer.
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

  const poll = useCallback(async () => {
    if (!hostId) return
    try {
      const snap = await telemetryApi.get(hostId)
      const now = Date.now()
      let netRx = 0
      let netTx = 0
      if (
        lastAbs.current &&
        snap.net_bytes_recv != null &&
        snap.net_bytes_sent != null
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
      if (snap.net_bytes_recv != null && snap.net_bytes_sent != null) {
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

      setPoints((prev) => [...prev.slice(-120), point])
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
  }, [hostId])

  useEffect(() => {
    lastAbs.current = null
    setPoints([])
    setError(null)

    if (!hostId || !enabled) {
      setStatus('closed')
      return
    }

    setStatus('connecting')
    setIsLoading(true)
    void poll().finally(() => setIsLoading(false))

    const id = window.setInterval(() => {
      void poll()
    }, pollIntervalMs)

    return () => window.clearInterval(id)
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
