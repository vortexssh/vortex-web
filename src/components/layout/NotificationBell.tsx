import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { billingApi } from '@/services/billingApi'
import { ApiError } from '@/services/apiClient'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => billingApi.listNotifications(false),
    refetchInterval: 60_000,
  })

  const unread = (listQuery.data ?? []).filter((n) => !n.read_at).length

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const readMutation = useMutation({
    mutationFn: (id: string) => billingApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMutation = useMutation({
    mutationFn: () => billingApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      toast('All notifications marked read', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Failed', 'error'),
  })

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative rounded-md border border-border p-2 text-dim transition-colors hover:border-neon/40 hover:text-neon"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon px-1 font-mono text-[9px] font-bold text-void">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Notifications
            </span>
            <Button
              variant="ghost"
              className="!px-2 !py-0.5 text-[10px]"
              disabled={unread === 0 || readAllMutation.isPending}
              onClick={() => readAllMutation.mutate()}
            >
              Mark all read
            </Button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(listQuery.data ?? []).length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">Inbox empty</li>
            ) : (
              (listQuery.data ?? []).slice(0, 20).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left hover:bg-panel ${
                      n.read_at ? 'opacity-60' : ''
                    }`}
                    onClick={() => {
                      if (!n.read_at) readMutation.mutate(n.id)
                    }}
                  >
                    <span className="text-sm text-fg-strong">{n.title}</span>
                    <span className="font-mono text-[11px] text-muted">{n.body}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
