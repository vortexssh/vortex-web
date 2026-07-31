import { create } from 'zustand'
import { authApi } from '@/services/authApi'
import { setStoredToken } from '@/services/apiClient'
import { TOKEN_STORAGE_KEY } from '@/config/env'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  bootstrapped: boolean
  setSession: (user: User, accessToken: string) => void
  clearSession: () => void
  setUser: (user: User) => void
  bootstrap: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: sessionStorage.getItem(TOKEN_STORAGE_KEY),
  bootstrapped: false,

  setSession: (user, accessToken) => {
    setStoredToken(accessToken)
    set({ user, accessToken })
  },

  clearSession: () => {
    setStoredToken(null)
    set({ user: null, accessToken: null })
  },

  setUser: (user) => set({ user }),

  bootstrap: async () => {
    const token = get().accessToken ?? sessionStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) {
      set({ bootstrapped: true, user: null, accessToken: null })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, accessToken: token, bootstrapped: true })
    } catch {
      setStoredToken(null)
      set({ user: null, accessToken: null, bootstrapped: true })
    }
  },
}))
