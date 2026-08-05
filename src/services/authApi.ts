import { apiRequest, setStoredToken } from './apiClient'
import type { AuthTokens, RegisterResponse, TotpSetupResponse, User } from '@/types'

export interface Credentials {
  email: string
  password: string
}

export interface LoginPayload extends Credentials {
  totp_code?: string
}

export const authApi = {
  register(payload: Credentials): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  login(payload: LoginPayload): Promise<AuthTokens> {
    return apiRequest<AuthTokens>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  verifyEmail(token: string): Promise<AuthTokens> {
    return apiRequest<AuthTokens>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      auth: false,
    })
  },

  resendVerification(email: string): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
      auth: false,
    })
  },

  me(): Promise<User> {
    return apiRequest<User>('/users/me')
  },

  updateMe(payload: {
    email?: string
    public_slug?: string | null
    preferred_currency?: string
  }): Promise<User> {
    return apiRequest<User>('/users/me', { method: 'PATCH', body: payload })
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

  logout(): void {
    setStoredToken(null)
  },

  persistSession(tokens: AuthTokens): void {
    setStoredToken(tokens.access_token)
  },
}
