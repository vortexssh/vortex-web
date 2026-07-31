# Vortex Web

Cloud admin console for VortexSSH — talks to **Vortex Core** (`/api/v1` + `/ws`).

## Local development

```bash
npm install
npm run dev
```

With Core on `:8000`, Vite proxies `/api` and `/ws`. Set `VITE_USE_MSW=false` in `.env`.

## Production deploy (Docker + Nginx)

Production domain: `https://vortex.timant32.ru` → API `https://api.vortex.timant32.ru`.

```bash
# On the VPS
mkdir -p /opt/vortex-web && cd /opt/vortex-web
git clone https://github.com/vortexssh/vortex-web.git .
cp .env.production.example .env
bash deploy/deploy.sh
```

Container listens on `127.0.0.1:18080`. Host nginx terminates TLS for `vortex.timant32.ru`.

**Required on Core:** `CORS_ORIGINS` must include `https://vortex.timant32.ru`.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | REST base (prod: `https://api.vortex.timant32.ru/api/v1`) |
| `VITE_WS_URL` | WS base (prod: `wss://api.vortex.timant32.ru/ws`) |
| `VITE_AGENT_CORE_URL` | Agent outbound WSS base |
| `VITE_USE_MSW` | Offline mocks (`true` only for local UI without Core) |

## Security

- No SSH passwords / private keys in the browser.
- Dashboard / Hosts / WebSSH / Tasks require `is_2fa_enabled`.
