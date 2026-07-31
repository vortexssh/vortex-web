import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { telemetryApi } from '@/services/telemetryApi'
import { TOKEN_STORAGE_KEY } from '@/config/env'
import { db } from '@/mocks/db'
import { USE_MSW } from '@/config/env'
import type { TelemetryPoint } from '@/types'
import { useWebSocket } from './useWebSocket'

function rangeIso(hours: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - hours * 3600_000)
  return { from: from.toISOString(), to: to.toISOString() }
}

interface UseTelemetryOptions {
  hostId: string | null
  hours: number
  enabled?: boolean
}

export function useTelemetrySocket({
  hostId,
  hours,
  enabled = true,
}: UseTelemetryOptions) {
  const [livePoints, setLivePoints] = useState<TelemetryPoint[]>([])
  const [mockStatus, setMockStatus] = useState<'connecting' | 'open' | 'closed'>('closed')
  const mockTimer = useRef<number | null>(null)

  const historyQuery = useQuery({
    queryKey: ['telemetry', hostId, hours],
    enabled: Boolean(hostId) && enabled,
    queryFn: async () => {
      if (!hostId) return []
      const res = await telemetryApi.history(hostId, rangeIso(hours))
      return res.points
    },
  })

  useEffect(() => {
    if (historyQuery.data) {
      setLivePoints(historyQuery.data)
    }
  }, [historyQuery.data])

  // Mock live stream when MSW is on (no real WS server)
  useEffect(() => {
    if (!USE_MSW || !hostId || !enabled) {
      setMockStatus('closed')
      return
    }
    setMockStatus('connecting')
    const start = window.setTimeout(() => setMockStatus('open'), 200)
    mockTimer.current = window.setInterval(() => {
      const point = db.livePoint(hostId)
      if (point) {
        setLivePoints((prev) => [...prev.slice(-400), point])
      }
    }, 5000)
    return () => {
      window.clearTimeout(start)
      if (mockTimer.current) window.clearInterval(mockTimer.current)
      setMockStatus('closed')
    }
  }, [hostId, enabled])

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const wsUrl =
    !USE_MSW && hostId && token
      ? `${import.meta.env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`}/telemetry?host_id=${hostId}&token=${encodeURIComponent(token)}`
      : null

  const onMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(String(event.data)) as TelemetryPoint & { host_id?: string }
      setLivePoints((prev) => [...prev.slice(-400), data])
    } catch {
      // ignore malformed
    }
  }, [])

  const realWs = useWebSocket({
    url: wsUrl,
    enabled: Boolean(wsUrl) && enabled,
    onMessage,
  })

  const status = USE_MSW ? mockStatus : realWs.status
  const reconnect = USE_MSW
    ? () => {
        /* mock always live */
      }
    : realWs.reconnect

  return {
    points: livePoints,
    status,
    reconnect,
    isLoading: historyQuery.isLoading,
    error: historyQuery.error,
  }
}
