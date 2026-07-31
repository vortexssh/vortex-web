import { create } from 'zustand'
import { X } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ items: [...s.items, { id, message, tone }] }))
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
    }, 4200)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-border text-dim',
  success: 'border-neon/40 text-neon',
  error: 'border-danger/40 text-danger',
}

export function ToastViewport() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-sm shadow-glow-sm ${TONE_CLASS[t.tone]}`}
        >
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function toast(message: string, tone?: ToastTone): void {
  useToastStore.getState().push(message, tone)
}
