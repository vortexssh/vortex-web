# Vortex Web

Cloud admin console for the VortexSSH hybrid ecosystem — telemetry, host manager, WebSSH terminal, and task scheduler.

## Stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4
- React Router · Zustand · TanStack Query · Recharts · xterm.js
- MSW mock API (default) until Vortex Core is available

## Quick start

```bash
npm install
npm run dev
```

Demo credentials (MSW): `admin@vortex.local` / `vortex123`

After login, enable 2FA (any 6-digit code against the mock) to unlock Dashboard, Hosts, WebSSH, and Tasks.

## Environment

Copy [`.env.example`](.env.example):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | REST base path |
| `VITE_WS_URL` | derived from host | WebSocket base (`…/ws`) |
| `VITE_USE_MSW` | `true` | `false` to hit real Vortex Core via Vite proxy |

When integrating Core:

```bash
VITE_USE_MSW=false npm run dev
```

Vite proxies `/api` and `/ws` to `http://127.0.0.1:8000`.

## Security invariants

- Frontend stores **metadata only** — no SSH passwords or private keys in forms/API payloads.
- Routes Dashboard / Hosts / WebSSH / Tasks redirect to `/security/2fa` when `is_2fa_enabled` is false.
- JWT access token lives in `sessionStorage` (`vortex_access_token`) until Core supports httpOnly cookies.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Project layout

```
src/
  components/   # layout, auth gates, UI kit
  features/     # auth, dashboard, hosts, terminal, tasks, settings
  hooks/        # useWebSocket, useTelemetrySocket, useTerminalSocket
  mocks/        # MSW handlers + in-memory DB
  services/     # REST clients
  store/        # Zustand auth
  types/        # API contracts aligned with ТЗ §5
```
