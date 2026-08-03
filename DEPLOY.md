# Vortex Web — деплой

## Сервер

- Path: `/opt/vortex-web` — **только SPA**
- Container: `127.0.0.1:18080` → nginx
- Domain: `vortex.timant32.ru`
- API: `api.vortex.timant32.ru`

Агент **не** входит в образ Web. Enroll качает бинарник с отдельного URL
(`VITE_AGENT_BINARY_BASE_URL`) — CDN, GitHub Release assets, свой static host.

## Сборка

В `/opt/vortex-web/.env`:

```env
VITE_API_URL=https://api.vortex.timant32.ru/api/v1
VITE_WS_URL=wss://api.vortex.timant32.ru/ws
VITE_AGENT_CORE_URL=wss://api.vortex.timant32.ru
# Пример: публичный или приватный CDN / Release download base (без trailing slash)
VITE_AGENT_BINARY_BASE_URL=https://github.com/vortexssh/vortex-agent/releases/download/v0.1.0
```

```bash
cd /opt/vortex-web
git pull
docker compose --env-file .env up -d --build
```

Файлы по адресу должны называться:
`vortex-agent-linux-amd64`, `vortex-agent-linux-arm64`.

Локально для dev: `cd VortexAgent && make publish-web` + Vite, либо
`VITE_AGENT_BINARY_BASE_URL=http://127.0.0.1:5173/agent`.

## CORS на Core

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```
