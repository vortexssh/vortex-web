# Vortex Web — деплой

## Сервер

- Path: `/opt/vortex-web` — **только Web** (исходники агента здесь не нужны)
- Container: `127.0.0.1:18080` → nginx SPA
- Domain: `vortex.timant32.ru`
- API: `api.vortex.timant32.ru`

Агент ставится **бинарем на целевые машины**. Web лишь раздаёт уже собранные
файлы с `https://vortex.timant32.ru/agent/vortex-agent-linux-*` для one-liner’а.

## Откуда берутся бинарники

При `docker compose build` образ скачивает assets из **GitHub Release** репо
`vortexssh/vortex-agent` (не клонирует исходники).

1. На машине разработки / в CI один раз:
   ```bash
   cd VortexAgent
   make cross-linux
   gh release create v0.1.0 \
     bin/vortex-agent-linux-amd64 \
     bin/vortex-agent-linux-arm64 \
     --title v0.1.0 --generate-notes
   ```
2. На web-сервере в `/opt/vortex-web/.env` (репо приватное):
   ```env
   AGENT_GIT_TOKEN=ghp_xxx   # Contents:read; не коммитить
   AGENT_RELEASE=latest      # или v0.1.0
   ```
3. `docker compose --env-file .env up -d --build`

## Обновление Web

```bash
cd /opt/vortex-web
git pull
docker compose --env-file .env up -d --build
```

`VITE_AGENT_BINARY_BASE_URL` не обязателен — Install agent подставляет
`https://vortex.timant32.ru/agent`.

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
# 200, не text/html
```
