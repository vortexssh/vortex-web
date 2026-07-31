import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/services/tasksApi'
import { hostsApi } from '@/services/hostsApi'
import { ApiError } from '@/services/apiClient'
import type { Task, TaskLog } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { Toggle } from '@/components/ui/Toggle'
import { toast } from '@/components/ui/Toast'

export function TasksPage() {
  const qc = useQueryClient()
  const hostsQuery = useQuery({ queryKey: ['hosts'], queryFn: () => hostsApi.list() })
  const hostIds = (hostsQuery.data ?? []).map((h) => h.id)

  const tasksQuery = useQuery({
    queryKey: ['tasks', hostIds],
    enabled: hostIds.length > 0,
    queryFn: () => tasksApi.listAll(hostIds),
  })

  const hostsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of hostsQuery.data ?? []) map.set(h.id, h.name)
    return map
  }, [hostsQuery.data])

  const [editor, setEditor] = useState<Task | 'new' | null>(null)
  const [logsTask, setLogsTask] = useState<Task | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      toast('Task deleted', 'success')
    },
  })

  const runMutation = useMutation({
    mutationFn: (id: string) => tasksApi.run(id),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: ['task-logs', task.id] })
      toast('Task dispatched to agent', 'success')
    },
    onError: (err: unknown) =>
      toast(err instanceof ApiError ? err.message : 'Run failed', 'error'),
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-dim">Cron and one-shot scripts executed by the host agent.</p>
        <Button onClick={() => setEditor('new')} disabled={(hostsQuery.data ?? []).length === 0}>
          + New task
        </Button>
      </div>

      <Table
        rows={tasksQuery.data ?? []}
        rowKey={(t) => t.id}
        empty="No tasks yet"
        columns={[
          {
            key: 'name',
            header: 'Task',
            render: (t) => (
              <div>
                <div className="text-white">{t.name}</div>
                <div className="font-mono text-[11px] text-muted">
                  {hostsById.get(t.host_id) ?? t.host_id}
                </div>
              </div>
            ),
          },
          {
            key: 'schedule',
            header: 'Schedule',
            render: (t) => (
              <span className="font-mono text-xs text-dim">{t.cron_expr ?? 'one-shot'}</span>
            ),
          },
          {
            key: 'active',
            header: 'Active',
            render: (t) => (
              <Badge tone={t.is_active ? 'neon' : 'muted'}>{t.is_active ? 'yes' : 'no'}</Badge>
            ),
          },
          {
            key: 'cmd',
            header: 'Command',
            render: (t) => (
              <code className="line-clamp-1 max-w-xs font-mono text-[11px] text-muted">
                {t.command}
              </code>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (t) => (
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  className="!text-xs"
                  onClick={() => runMutation.mutate(t.id)}
                >
                  Run
                </Button>
                <Button variant="outline" className="!text-xs" onClick={() => setLogsTask(t)}>
                  Logs
                </Button>
                <Button variant="outline" className="!text-xs" onClick={() => setEditor(t)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  className="!text-xs"
                  onClick={() => {
                    if (confirm(`Delete ${t.name}?`)) deleteMutation.mutate(t.id)
                  }}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editor ? (
        <TaskEditorModal
          task={editor === 'new' ? null : editor}
          hosts={hostsQuery.data ?? []}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {logsTask ? <LogsModal task={logsTask} onClose={() => setLogsTask(null)} /> : null}
    </div>
  )
}

function TaskEditorModal({
  task,
  hosts,
  onClose,
}: {
  task: Task | null
  hosts: { id: string; name: string; agent: { is_online: boolean } | null }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [hostId, setHostId] = useState(task?.host_id ?? hosts[0]?.id ?? '')
  const [name, setName] = useState(task?.name ?? '')
  const [command, setCommand] = useState(task?.command ?? '')
  const [cron, setCron] = useState(task?.cron_expr ?? '')
  const [active, setActive] = useState(task?.is_active ?? true)
  const [error, setError] = useState<string | null>(null)

  const host = hosts.find((h) => h.id === hostId)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (task) {
        return tasksApi.update(task.id, {
          name,
          command,
          cron_expr: cron.trim() ? cron.trim() : null,
          is_active: active,
        })
      }
      return tasksApi.create(hostId, {
        name,
        command,
        cron_expr: cron.trim() ? cron.trim() : null,
        is_active: active,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      toast(task ? 'Task updated' : 'Task created', 'success')
      onClose()
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Save failed'),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <Modal
      open
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="task-form" type="submit" disabled={saveMutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="task-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        {!task ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted">Host</span>
            <select
              className="rounded-md border border-border bg-void px-3 py-2 font-mono text-sm text-white"
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              required
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {!h.agent?.is_online ? ' (agent offline)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {host && !host.agent?.is_online ? (
          <p className="text-xs text-warn">
            Warning: agent is offline — runs will fail until it reconnects.
          </p>
        ) : null}
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted">Command</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-void px-3 py-2 font-mono text-sm text-white outline-none focus:border-neon/50"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            required
          />
        </label>
        <Input
          label="Cron expression (optional)"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="0 2 * * * · empty = one-shot"
        />
        <Toggle checked={active} onChange={setActive} label="Active" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}

function LogsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const logsQuery = useQuery({
    queryKey: ['task-logs', task.id],
    queryFn: () => tasksApi.logs(task.id),
  })
  const [selected, setSelected] = useState<TaskLog | null>(null)

  return (
    <Modal open title={`Logs · ${task.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {(logsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-auto">
            {(logsQuery.data ?? []).map((log) => (
              <li key={log.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded border border-border px-2 py-1.5 text-left text-xs hover:border-neon/30"
                  onClick={() => setSelected(log)}
                >
                  <span className="font-mono text-muted">
                    {new Date(log.executed_at).toLocaleString()}
                  </span>
                  <Badge
                    tone={
                      log.status === 'SUCCESS'
                        ? 'neon'
                        : log.status === 'TIMEOUT'
                          ? 'warn'
                          : 'danger'
                    }
                  >
                    {log.status} · {log.exit_code ?? '—'}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected ? (
          <div className="grid gap-2">
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-void p-3 font-mono text-[11px] text-neon whitespace-pre-wrap">
              {selected.stdout || '(empty stdout)'}
            </pre>
            {selected.stderr ? (
              <pre className="max-h-32 overflow-auto rounded-md border border-danger/30 bg-void p-3 font-mono text-[11px] text-danger whitespace-pre-wrap">
                {selected.stderr}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
