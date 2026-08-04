import { useCallback, useEffect, useRef, useState } from 'react'
import { TOKEN_STORAGE_KEY, WS_BASE_URL } from '@/config/env'
import { useWebSocket } from './useWebSocket'

export type TerminalConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

interface UseTerminalSocketOptions {
  hostId: string | null
  /** Connect only after xterm has been fitted (real cols/rows). */
  enabled?: boolean
  cols?: number
  rows?: number
  onData: (data: string) => void
}

/**
 * Core PTY tunnel: WS /ws/pty/{host_id}?token=&cols=&rows=
 * Stdin: raw text/binary. Resize: JSON {type:pty_resize,cols,rows} (no reconnect).
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
  const sessionIdRef = useRef<string | null>(null)
  // Freeze geometry used in the connect URL so later fits don't reconnect.
  const connectDimsRef = useRef<{ cols: number; rows: number } | null>(null)

  useEffect(() => {
    sessionIdRef.current = null
    connectDimsRef.current = null
  }, [hostId])

  if (enabled && hostId && !connectDimsRef.current) {
    connectDimsRef.current = {
      cols: Math.max(1, cols),
      rows: Math.max(1, rows),
    }
  }
  if (!enabled) {
    connectDimsRef.current = null
    sessionIdRef.current = null
  }

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const dim = connectDimsRef.current
  const wsUrl =
    hostId && token && enabled && dim
      ? `${WS_BASE_URL}/pty/${hostId}?token=${encodeURIComponent(token)}&cols=${dim.cols}&rows=${dim.rows}`
      : null

  const onMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data) as {
          type?: string
          session_id?: string
          data?: string
          encoding?: string
        }
        if (msg.type === 'pty_ready') {
          if (msg.session_id) sessionIdRef.current = msg.session_id
          return
        }
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

  const resize = useCallback(
    (nextCols: number, nextRows: number) => {
      const c = Math.max(1, Math.floor(nextCols))
      const r = Math.max(1, Math.floor(nextRows))
      if (c < 1 || r < 1) return
      send(
        JSON.stringify({
          type: 'pty_resize',
          session_id: sessionIdRef.current,
          cols: c,
          rows: r,
        }),
      )
    },
    [send],
  )

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
