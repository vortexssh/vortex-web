import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { hostsApi } from '@/services/hostsApi'
import { useTerminalSocket } from '@/hooks/useTerminalSocket'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export function TerminalPage() {
  const { hostId: routeHostId } = useParams()
  const navigate = useNavigate()
  const hostsQuery = useQuery({ queryKey: ['hosts'], queryFn: () => hostsApi.list() })
  const hosts = hostsQuery.data ?? []
  const online = hosts.filter((h) => h.agent?.is_online)
  const [hostId, setHostId] = useState<string | null>(routeHostId ?? null)
  const selectedId = hostId ?? online[0]?.id ?? null
  const selected = hosts.find((h) => h.id === selectedId)

  useEffect(() => {
    if (routeHostId) setHostId(routeHostId)
  }, [routeHostId])

  if (!hostsQuery.isLoading && online.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel p-8">
        <h2 className="font-mono text-sm uppercase tracking-wider text-neon">No online agents</h2>
        <p className="mt-2 text-sm text-dim">
          WebSSH requires an online Vortex Agent. Install an agent from Host Manager.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-panel px-3 py-1.5 font-mono text-xs text-dim"
          value={selectedId ?? ''}
          onChange={(e) => {
            setHostId(e.target.value)
            navigate(`/terminal/${e.target.value}`)
          }}
        >
          {hosts.map((h) => (
            <option key={h.id} value={h.id} disabled={!h.agent?.is_online}>
              {h.name}
              {!h.agent?.is_online ? ' (offline)' : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          No server password — session runs as the agent process user.
        </p>
      </div>

      {selectedId && selected?.agent?.is_online ? (
        <TerminalView hostId={selectedId} hostName={selected.name} />
      ) : (
        <div className="rounded-lg border border-border bg-panel p-6 text-sm text-dim">
          Select a host with an online agent.
        </div>
      )}
    </div>
  )
}

function TerminalView({ hostId, hostName }: { hostId: string; hostName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  const onData = useCallback((data: string) => {
    termRef.current?.write(data)
  }, [])

  const { status, sendInput, resize, reconnect } = useTerminalSocket({
    hostId,
    enabled: true,
    onData,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      theme: {
        background: '#0a0a0a',
        foreground: '#39ff14',
        cursor: '#39ff14',
        selectionBackground: '#39ff1440',
        black: '#0a0a0a',
        green: '#39ff14',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const disposable = term.onData((data) => sendInput(data))

    const onResize = () => {
      fit.fit()
      resize(term.cols, term.rows)
    }
    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      disposable.dispose()
      window.removeEventListener('resize', onResize)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [hostId, sendInput, resize])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-void">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-dim">{hostName}</span>
          <Badge tone={status === 'open' ? 'neon' : status === 'connecting' ? 'warn' : 'danger'}>
            {status}
          </Badge>
        </div>
        {status !== 'open' ? (
          <Button variant="outline" className="!text-xs" onClick={reconnect}>
            Reconnect
          </Button>
        ) : null}
      </div>
      <div ref={containerRef} className="min-h-[420px] flex-1 p-2" />
    </div>
  )
}
