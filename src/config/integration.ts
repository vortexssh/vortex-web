/**
 * Vortex Core integration map (live API).
 *
 * REST base: /api/v1
 * Auth: Authorization: Bearer <jwt>
 * Errors: { error: { code, message, details? } }
 *
 * Boot Core:
 *   cd ../VortexCore && docker compose up -d
 *   source .venv/bin/activate && alembic upgrade head
 *   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
 *
 * Smoke:
 *   register → verify-email → login → /users/me → 2FA setup/verify → hosts → agents → telemetry poll → /ws/pty
 */

export const CORE_ROUTES = {
  health: '/api/v1/health',
  authRegister: '/api/v1/auth/register',
  authLogin: '/api/v1/auth/login',
  authVerifyEmail: '/api/v1/auth/verify-email',
  authResendVerification: '/api/v1/auth/resend-verification',
  me: '/api/v1/users/me',
  totpSetup: '/api/v1/auth/2fa/setup',
  wsPty: '/ws/pty/{host_id}',
  wsProxy: '/ws/proxy/{host_id}',
  wsAgent: '/ws/agent',
} as const
