# Vortex Web — деплой

## Сервер

- `/opt/vortex-web` — SPA (docker `:18080`)
- Host nginx: TLS + **статика** `/agent/` → `/opt/vortex-web/agent-bins/`
- SPA в docker **не** раздаёт агент (иначе легко получить `index.html`)

## Агент: собрать и положить

```bash
cd VortexAgent && make cross-linux

mkdir -p /opt/vortex-web/agent-bins
cp -f bin/vortex-agent-linux-amd64 bin/vortex-agent-linux-arm64 /opt/vortex-web/agent-bins/
# или scp с другой машины в тот же путь
chmod 644 /opt/vortex-web/agent-bins/vortex-agent-linux-*
ls -lh /opt/vortex-web/agent-bins/
```

## Host nginx: `/agent/` напрямую

В site-конфиге `vortex.timant32.ru` (см. `deploy/nginx-vortex.timant32.ru.conf`):

```nginx
location ^~ /agent/ {
    alias /opt/vortex-web/agent-bins/;
    default_type application/octet-stream;
    add_header Cache-Control "public, max-age=3600";
    add_header X-Content-Type-Options nosniff;
}
```

Этот `location` должен быть **выше** `location /` с `proxy_pass` на `:18080`.

```bash
# найти активный конфиг
grep -R "vortex.timant32.ru" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null

# после правки:
nginx -t && systemctl reload nginx

curl -sI https://vortex.timant32.ru/agent/vortex-agent-linux-amd64 | head -8
# content-type: application/octet-stream
# content-length: ~6xxxxxx   (НЕ text/html, НЕ ~900 байт)
```

## Web SPA

```bash
cd /opt/vortex-web
# .env: VITE_AGENT_BINARY_BASE_URL=https://vortex.timant32.ru/agent
git pull
docker compose --env-file .env up -d --build
```

Volume `agent-bins` в compose опционален, если host nginx уже раздаёт файлы с диска.

## CORS на Core

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```
