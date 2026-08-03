# Vortex Web — деплой

## Сервер

- `/opt/vortex-web` — SPA + volume с бинарниками агента
- `127.0.0.1:18080` → docker nginx
- Бинарники: `/opt/vortex-web/agent-bins/` → `https://vortex.timant32.ru/agent/...`

## Собрать агент и выложить

```bash
# где есть исходники агента
cd VortexAgent && make cross-linux

# на сервере с Web
mkdir -p /opt/vortex-web/agent-bins
scp bin/vortex-agent-linux-amd64 bin/vortex-agent-linux-arm64 \
  root@timant32:/opt/vortex-web/agent-bins/
# или локально на том же хосте:
# cp bin/vortex-agent-linux-* /opt/vortex-web/agent-bins/

ls -la /opt/vortex-web/agent-bins/
# ожидается ~6MB на файл, не пустая папка с .gitkeep
```

Подтянуть compose (volume `./agent-bins`) и nginx с `location /agent/`:

```bash
cd /opt/vortex-web
# .env: VITE_AGENT_BINARY_BASE_URL=https://vortex.timant32.ru/agent
git pull
docker compose --env-file .env up -d --build
```

Проверка — **не** `text/html` и не ~1KB:

```bash
curl -sI http://127.0.0.1:18080/agent/vortex-agent-linux-amd64 | head -8
curl -sI https://vortex.timant32.ru/agent/vortex-agent-linux-amd64 | head -8
docker compose exec web ls -la /usr/share/nginx/html/agent/
```

Если снаружи HTML ~931 байт — бинарников нет в volume или контейнер без нового `nginx-spa.conf` (SPA отдаёт `index.html`).

## CORS на Core

```env
CORS_ORIGINS=https://vortex.timant32.ru,https://api.vortex.timant32.ru
```
