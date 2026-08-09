import { API_BASE_URL, TOKEN_STORAGE_KEY } from '@/config/env'
import type { ApiErrorBody } from '@/types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  /** JSON-serializable value, or FormData (multipart; Content-Type left unset). */
  body?: unknown
  auth?: boolean
}

function parseError(status: number, data: unknown, fallback: string): ApiError {
  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    data.error &&
    typeof data.error === 'object'
  ) {
    const err = (data as ApiErrorBody).error
    return new ApiError(status, err.code || 'http_error', err.message || fallback)
  }
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return new ApiError(status, 'http_error', detail)
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const d = detail as { code?: string; message: string }
      return new ApiError(status, d.code ?? 'http_error', d.message)
    }
  }
  return new ApiError(status, 'http_error', fallback)
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers: initHeaders, ...rest } = options
  const headers = new Headers(initHeaders)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw parseError(response.status, data, response.statusText || 'Request failed')
  }

  return data as T
}
