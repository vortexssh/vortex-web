/**
 * Device-link helpers for Vortex TUI (and future GUI).
 * Auth UI lives in Vortex Web; Core stays API-only.
 *
 * TUI opens: /login?client=vortex-tui&redirect_uri=http://127.0.0.1:<port>/callback&state=...
 * After success we mint an API key and bounce back to redirect_uri.
 */

export type TuiLinkParams = {
  client: string
  redirectUri: string
  state: string
}

export function parseTuiLinkParams(search: string): TuiLinkParams | null {
  const q = new URLSearchParams(search)
  const client = q.get('client') ?? ''
  const redirectUri = q.get('redirect_uri') ?? ''
  const state = q.get('state') ?? ''
  if (client !== 'vortex-tui') return null
  if (!redirectUri || !state) return null
  if (!isLoopbackRedirect(redirectUri)) return null
  return { client, redirectUri, state }
}

export function isLoopbackRedirect(uri: string): boolean {
  try {
    const u = new URL(uri)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
  } catch {
    return false
  }
}

export function buildTuiCallbackUrl(
  redirectUri: string,
  params: { token: string; state: string; email: string },
): string {
  const u = new URL(redirectUri)
  u.searchParams.set('token', params.token)
  u.searchParams.set('state', params.state)
  u.searchParams.set('email', params.email)
  u.searchParams.set('token_type', 'api_key')
  return u.toString()
}

export function tuiLinkQuery(params: TuiLinkParams): string {
  const q = new URLSearchParams({
    client: params.client,
    redirect_uri: params.redirectUri,
    state: params.state,
  })
  return q.toString()
}
