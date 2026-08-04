import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeId =
  | 'matrix'
  | 'amber'
  | 'arctic'
  | 'crimson'
  | 'slate'
  | 'daybreak'

export interface ThemeMeta {
  id: ThemeId
  name: string
  blurb: string
  preview: [string, string, string]
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'matrix',
    name: 'Matrix',
    blurb: 'Neon green terminal · hard glow',
    preview: ['#0a0a0a', '#39ff14', '#111111'],
  },
  {
    id: 'amber',
    name: 'Amber CRT',
    blurb: 'Phosphor amber · soft scanline vibe',
    preview: ['#0c0a06', '#ffb000', '#16120a'],
  },
  {
    id: 'arctic',
    name: 'Arctic Ops',
    blurb: 'Ice cyan · cooler, quieter chrome',
    preview: ['#070b10', '#38bdf8', '#0e1520'],
  },
  {
    id: 'crimson',
    name: 'Crimson Ops',
    blurb: 'Blood-red accents · aggressive',
    preview: ['#0a0606', '#ff3355', '#140c0c'],
  },
  {
    id: 'slate',
    name: 'Slate Pro',
    blurb: 'Muted professional · no glow',
    preview: ['#0f1115', '#94a3b8', '#171a21'],
  },
  {
    id: 'daybreak',
    name: 'Daybreak',
    blurb: 'Light panel · high contrast ink',
    preview: ['#f4f1ea', '#0f766e', '#ffffff'],
  },
]

interface ThemeState {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'matrix',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'vortex-theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? 'matrix')
      },
    },
  ),
)

/** Call once at boot before paint if possible. */
export function initTheme(): void {
  const stored = localStorage.getItem('vortex-theme')
  let theme: ThemeId = 'matrix'
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { state?: { theme?: ThemeId } }
      if (parsed.state?.theme && THEMES.some((t) => t.id === parsed.state?.theme)) {
        theme = parsed.state.theme
      }
    } catch {
      /* ignore */
    }
  }
  applyTheme(theme)
}
