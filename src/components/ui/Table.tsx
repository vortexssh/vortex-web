import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
}

export function Table<T>({ columns, rows, rowKey, empty = 'No data' }: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-10 text-center text-sm text-muted">
        {empty}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-surface/60 font-mono text-[10px] uppercase tracking-wider text-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-2.5 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border/70 transition-colors last:border-0 hover:bg-surface/50"
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
