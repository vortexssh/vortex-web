export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

/** Set VITE_USE_MSW=true only for offline UI work without Core. */
export const USE_MSW = import.meta.env.VITE_USE_MSW === 'true'

export const TOKEN_STORAGE_KEY = 'vortex_access_token'
