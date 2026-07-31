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

## CORS на Core

В `/opt/vortex-core/.env`:

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```

Затем:

```bash
cd /opt/vortex-core && docker compose up -d
```
