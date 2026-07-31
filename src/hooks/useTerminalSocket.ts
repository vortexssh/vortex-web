import { useCallback, useEffect, useRef, useState } from 'react'
import { TOKEN_STORAGE_KEY, WS_BASE_URL } from '@/config/env'
import { useWebSocket } from './useWebSocket'

export type TerminalConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

interface UseTerminalSocketOptions {
  hostId: string | null
  enabled?: boolean
  cols?: number
  rows?: number
  onData: (data: string) => void
}

/**
 * Core PTY tunnel: WS /ws/pty/{host_id}?token=&cols=&rows=
 * Client sends raw bytes/text; agent frames arrive as binary or JSON.
 */
export function useTerminalSocket({
  hostId,
  enabled = true,
  cols = 80,
  rows = 24,
  onData,
}: UseTerminalSocketOptions) {
  const onDataRef = useRef(onData)
  onDataRef.current = onData
  const [dims, setDims] = useState({ cols, rows })

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const wsUrl =
    hostId && token && enabled
      ? `${WS_BASE_URL}/pty/${hostId}?token=${encodeURIComponent(token)}&cols=${dims.cols}&rows=${dims.rows}`
      : null

  const onMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data) as {
          type?: string
          data?: string
          encoding?: string
        }
        if (msg.type === 'pty_ready') return
        if (msg.type === 'pty_data' && msg.data) {
          if (msg.encoding === 'base64') {
            onDataRef.current(atob(msg.data))
          } else {
            onDataRef.current(msg.data)
          }
          return
        }
        if (msg.type === 'pty_close') {
          onDataRef.current('\r\n\x1b[31m[session closed]\x1b[0m\r\n')
          return
        }
      } catch {
        onDataRef.current(event.data)
      }
      return
    }
    if (event.data instanceof ArrayBuffer) {
      onDataRef.current(new TextDecoder().decode(event.data))
      return
    }
    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((buf) => {
        onDataRef.current(new TextDecoder().decode(buf))
      })
    }
  }, [])

  const { status, send, reconnect } = useWebSocket({
    url: wsUrl,
    enabled: Boolean(wsUrl),
    onMessage,
  })

  const sendInput = useCallback(
    (data: string) => {
      send(data)
    },
    [send],
  )

  const resize = useCallback((nextCols: number, nextRows: number) => {
    setDims({ cols: nextCols, rows: nextRows })
  }, [])

  // Reconnect when dims change significantly after session open is handled by URL change
  useEffect(() => {
    setDims({ cols, rows })
  }, [hostId, cols, rows])

  const connStatus: TerminalConnStatus =
    !hostId || !enabled
      ? 'idle'
      : status === 'open'
        ? 'open'
        : status === 'connecting'
          ? 'connecting'
          : status === 'error'
            ? 'error'
            : 'closed'

  return {
    status: connStatus,
    sendInput,
    resize,
    reconnect,
  }
}
