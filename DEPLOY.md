# Vortex Web — деплой

## Сервер

- Path: `/opt/vortex-web`
- Agent source: `/opt/vortex-agent` (нужен для сборки бинарников в образ)
- Container: `127.0.0.1:18080` → nginx SPA
- Domain: `vortex.timant32.ru`
- API: `api.vortex.timant32.ru`

## Первый запуск / агент рядом

Репозиторий `vortex-agent` приватный — Docker **не** клонирует его с GitHub.
Один раз положи исходники рядом (тем же доступом, что и web):

```bash
# тем же способом, как клонировал vortex-web (deploy key / credential helper)
sudo git clone git@github.com:vortexssh/vortex-agent.git /opt/vortex-agent
# или HTTPS с credential helper
```

Переопределить путь: в `.env` → `VORTEX_AGENT_SRC=/path/to/vortex-agent`.

## Обновление

```bash
cd /opt/vortex-agent && sudo git pull
cd /opt/vortex-web && git pull
docker compose --env-file .env up -d --build
```

Образ сам скомпилирует `vortex-agent-linux-amd64/arm64` и положит в `/agent/`.
`VITE_AGENT_BINARY_BASE_URL` не нужен — Install agent берёт `https://vortex.timant32.ru/agent`.

## CORS на Core

В `/opt/vortex-core/.env`:

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```

```bash
cd /opt/vortex-core && docker compose up -d
```

## Проверка

```bash
curl -sI https://vortex.timant32.ru/agent/vortex-agent-linux-amd64 | head -5
# 200 + не text/html
```
