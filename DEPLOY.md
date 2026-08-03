# Vortex Web — деплой

## Сервер

- Path: `/opt/vortex-web`
- Container: `127.0.0.1:18080` → nginx SPA
- Domain: `vortex.timant32.ru`
- API: `api.vortex.timant32.ru` (уже задеплоен)

## Обновление

```bash
cd /opt/vortex-web
git pull
docker compose --env-file .env up -d --build
```

Сборка **сама** клонирует `vortex-agent`, кросс-компилирует linux/amd64+arm64 и кладёт в `/agent/`.
`VITE_AGENT_BINARY_BASE_URL` не нужен — Install agent подставляет `https://vortex.timant32.ru/agent`.

Если репозиторий агента приватный, в `/opt/vortex-web/.env`:

```env
AGENT_GIT_TOKEN=ghp_xxx   # fine-grained/read-only contents; не коммитьте
```

## CORS на Core

В `/opt/vortex-core/.env`:

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```

Затем:

```bash
cd /opt/vortex-core && docker compose up -d
```

## Проверка бинарников

```bash
curl -sI https://vortex.timant32.ru/agent/vortex-agent-linux-amd64 | head -5
# ожидается 200 и application/octet-stream (не text/html)
```
