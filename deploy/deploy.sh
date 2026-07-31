#!/usr/bin/env bash
# Deploy Vortex Web on the VPS (run as root from /opt/vortex-web).
set -euo pipefail

DOMAIN="${DOMAIN:-vortex.timant32.ru}"
API_ORIGIN="${API_ORIGIN:-https://api.vortex.timant32.ru}"
REPO_DIR="${REPO_DIR:-/opt/vortex-web}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"

cd "${REPO_DIR}"

if [[ -f .env.production.example && ! -f .env ]]; then
  cp .env.production.example .env
fi

echo "==> Building & starting container"
docker compose --env-file .env up -d --build

echo "==> Installing nginx site (HTTP bootstrap)"
mkdir -p /var/www/certbot
cp deploy/nginx-vortex.http.conf "${NGINX_SITE}"
ln -sfn "${NGINX_SITE}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  echo "==> Requesting TLS certificate"
  certbot --nginx -d "${DOMAIN}" \
    --non-interactive --agree-tos -m admin@timant32.ru --redirect
else
  echo "==> TLS already present for ${DOMAIN}"
  nginx -t && systemctl reload nginx
fi

echo "==> Hint: set Core CORS_ORIGINS to include https://${DOMAIN}"
echo "    Current API origin expected: ${API_ORIGIN}"
echo "Done. https://${DOMAIN}"
