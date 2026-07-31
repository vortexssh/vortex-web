import { useCallback, useEffect, useRef, useState } from 'react'

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseWebSocketOptions {
  url: string | null
  enabled?: boolean
  protocols?: string | string[]
  maxBackoffMs?: number
  onMessage?: (event: MessageEvent) => void
  onOpen?: () => void
}

interface UseWebSocketResult {
  status: WsStatus
  send: (data: string | ArrayBufferLike | Blob) => void
  reconnect: () => void
  lastError: string | null
}

export function useWebSocket({
  url,
  enabled = true,
  protocols,
  maxBackoffMs = 15_000,
  onMessage,
  onOpen,
}: UseWebSocketOptions): UseWebSocketResult {
  const [status, setStatus] = useState<WsStatus>('closed')
  const [lastError, setLastError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const intentionalClose = useRef(false)
  const onMessageRef = useRef(onMessage)
  const onOpenRef = useRef(onOpen)
  onMessageRef.current = onMessage
  onOpenRef.current = onOpen

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const connect = useCallback(() => {
    if (!url || !enabled) return
    clearTimer()
    intentionalClose.current = false
    setStatus('connecting')
    const ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      attemptRef.current = 0
      setStatus('open')
      setLastError(null)
      onOpenRef.current?.()
    }

    ws.onmessage = (event) => {
      onMessageRef.current?.(event)
    }

    ws.onerror = () => {
      setStatus('error')
      setLastError('WebSocket error')
    }

    ws.onclose = () => {
      setStatus('closed')
      wsRef.current = null
      if (intentionalClose.current || !enabled) return
      const delay = Math.min(maxBackoffMs, 500 * 2 ** attemptRef.current)
      attemptRef.current += 1
      timerRef.current = window.setTimeout(() => connect(), delay)
    }
  }, [url, enabled, protocols, maxBackoffMs])

  useEffect(() => {
    connect()
    return () => {
      intentionalClose.current = true
      clearTimer()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((data: string | ArrayBufferLike | Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data as string | Blob | ArrayBuffer)
    }
  }, [])

  const reconnect = useCallback(() => {
    intentionalClose.current = true
    clearTimer()
    wsRef.current?.close()
    attemptRef.current = 0
    connect()
  }, [connect])

  return { status, send, reconnect, lastError }
}
