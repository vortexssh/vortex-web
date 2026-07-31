import { useCallback, useEffect, useRef, useState } from 'react'
import { TOKEN_STORAGE_KEY, USE_MSW, WS_BASE_URL } from '@/config/env'
import { useWebSocket } from './useWebSocket'

export type TerminalConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

interface UseTerminalSocketOptions {
  hostId: string | null
  enabled?: boolean
  onData: (data: string) => void
}

export function useTerminalSocket({
  hostId,
  enabled = true,
  onData,
}: UseTerminalSocketOptions) {
  const [status, setStatus] = useState<TerminalConnStatus>('idle')
  const onDataRef = useRef(onData)
  onDataRef.current = onData
  const mockRef = useRef<{
    send: (data: string) => void
    close: () => void
  } | null>(null)

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  const wsUrl =
    !USE_MSW && hostId && token
      ? `${WS_BASE_URL}/terminal/${hostId}?token=${encodeURIComponent(token)}`
      : null

  const onMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data) as { type?: string; data?: string }
        if (msg.type === 'output' && msg.data) onDataRef.current(msg.data)
        else onDataRef.current(event.data)
      } catch {
        onDataRef.current(event.data)
      }
    }
  }, [])

  const realWs = useWebSocket({
    url: wsUrl,
    enabled: Boolean(wsUrl) && enabled,
    onMessage,
  })

  useEffect(() => {
    if (!USE_MSW || !hostId || !enabled) {
      mockRef.current = null
      setStatus(hostId && enabled ? 'idle' : 'idle')
      return
    }

    setStatus('connecting')
    const t = window.setTimeout(() => {
      setStatus('open')
      onDataRef.current(
        `\r\n\x1b[32mVortex agent pty · mock session · host ${hostId}\x1b[0m\r\n$ `,
      )
    }, 250)

    let buffer = ''
    mockRef.current = {
      send: (data: string) => {
        for (const ch of data) {
          if (ch === '\r' || ch === '\n') {
            const cmd = buffer
            buffer = ''
            onDataRef.current('\r\n')
            if (cmd.trim() === 'clear') {
              onDataRef.current('\x1b[2J\x1b[H')
            } else if (cmd.trim()) {
              onDataRef.current(
                `\x1b[90m[mock]\x1b[0m ran: ${cmd}\r\n`,
              )
            }
            onDataRef.current('$ ')
          } else if (ch === '\u007f') {
            if (buffer.length) {
              buffer = buffer.slice(0, -1)
              onDataRef.current('\b \b')
            }
          } else {
            buffer += ch
            onDataRef.current(ch)
          }
        }
      },
      close: () => setStatus('closed'),
    }

    return () => {
      window.clearTimeout(t)
      mockRef.current?.close()
      mockRef.current = null
      setStatus('closed')
    }
  }, [hostId, enabled])

  const sendInput = useCallback(
    (data: string) => {
      if (USE_MSW) {
        mockRef.current?.send(data)
        return
      }
      realWs.send(JSON.stringify({ type: 'input', data }))
    },
    [realWs],
  )

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (USE_MSW) return
      realWs.send(JSON.stringify({ type: 'resize', cols, rows }))
    },
    [realWs],
  )

  const connStatus: TerminalConnStatus = USE_MSW
    ? status
    : realWs.status === 'open'
      ? 'open'
      : realWs.status === 'connecting'
        ? 'connecting'
        : realWs.status === 'error'
          ? 'error'
          : 'closed'

  return {
    status: connStatus,
    sendInput,
    resize,
    reconnect: realWs.reconnect,
  }
}
