/**
 * Phase 7 integration checklist (Vortex Core)
 *
 * 1. Align OpenAPI with src/types and src/services/*
 * 2. Set VITE_USE_MSW=false
 * 3. Confirm JWT: Bearer header vs httpOnly cookie (update apiClient)
 * 4. Smoke: login → 2FA → host CRUD → telemetry WS → terminal pty → task run
 * 5. Verify field names: ip_address, is_proxy_enabled, cron_expr
 */

export const CORE_INTEGRATION_NOTES = {
  restBase: '/api',
  wsTelemetry: '/ws/telemetry',
  wsTerminal: '/ws/terminal/:hostId',
} as const
