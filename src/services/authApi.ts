import { apiRequest, setStoredToken } from './apiClient'
import type {
  AuthTokens,
  LoginResponse,
  TotpSetupResponse,
  User,
} from '@/types'

export interface Credentials {
  email: string
  password: string
}

export const authApi = {
  register(payload: Credentials): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  login(payload: Credentials): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  verifyLoginTotp(payload: { email: string; code: string }): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/login/2fa', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  logout(): Promise<void> {
    return apiRequest<void>('/auth/logout', { method: 'POST' }).finally(() => {
      setStoredToken(null)
    })
  },

  me(): Promise<User> {
    return apiRequest<User>('/auth/me')
  },

  setup2fa(): Promise<TotpSetupResponse> {
    return apiRequest<TotpSetupResponse>('/auth/2fa/setup', { method: 'POST' })
  },

  verify2fa(code: string): Promise<User> {
    return apiRequest<User>('/auth/2fa/verify', {
      method: 'POST',
      body: { code },
    })
  },

  disable2fa(code: string): Promise<User> {
    return apiRequest<User>('/auth/2fa/disable', {
      method: 'POST',
      body: { code },
    })
  },

  changePassword(payload: {
    current_password: string
    new_password: string
  }): Promise<void> {
    return apiRequest<void>('/auth/password', {
      method: 'POST',
      body: payload,
    })
  },

  persistSession(tokens: AuthTokens): void {
    setStoredToken(tokens.access_token)
  },
}
