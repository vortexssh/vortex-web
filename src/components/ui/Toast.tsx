import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

const MAX_TOASTS = 5
const TOAST_TTL_MS = 4500

const timers = new Map<string, number>()

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone = 'info') => {
    const trimmed = message.trim()
    if (!trimmed) return

    // Refresh TTL if the same message is already visible.
    const existing = get().items.find((t) => t.message === trimmed && t.tone === tone)
    if (existing) {
      const prev = timers.get(existing.id)
      if (prev) window.clearTimeout(prev)
      const tid = window.setTimeout(() => get().dismiss(existing.id), TOAST_TTL_MS)
      timers.set(existing.id, tid)
      return
    }

    const id = crypto.randomUUID()
    set((s) => ({
      items: [...s.items, { id, message: trimmed, tone }].slice(-MAX_TOASTS),
    }))
    const tid = window.setTimeout(() => get().dismiss(id), TOAST_TTL_MS)
    timers.set(id, tid)
  },
  dismiss: (id) => {
    const tid = timers.get(id)
    if (tid) {
      window.clearTimeout(tid)
      timers.delete(id)
    }
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
  },
}))

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-border-active text-dim',
  success: 'border-neon/50 text-neon',
  error: 'border-danger/50 text-danger',
}

export function ToastViewport() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-end gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex w-full items-start justify-between gap-3 rounded-md border bg-panel/95 px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm animate-[toast-in_180ms_ease-out] ${TONE_CLASS[t.tone]}`}
        >
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted hover:text-dim"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function toast(message: string, tone?: ToastTone): void {
  useToastStore.getState().push(message, tone)
}

/** Copy text and always surface a toast (success or clipboard error). */
export async function toastCopy(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(successMessage, 'success')
  } catch {
    toast('Clipboard unavailable — copy manually', 'error')
  }
}
