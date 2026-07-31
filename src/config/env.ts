export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

export const USE_MSW = import.meta.env.VITE_USE_MSW !== 'false'

export const TOKEN_STORAGE_KEY = 'vortex_access_token'
