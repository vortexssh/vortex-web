# syntax=docker/dockerfile:1
#
# Standalone build on the web host (no vortex-agent source needed):
#   cd /opt/vortex-web && docker compose up -d --build
#
# Agent is installed on *target servers* as a binary. This image only
# *hosts* prebuilt linux binaries at /agent/ for the enroll script to curl.
# Binaries are fetched from a GitHub Release of vortex-agent (private → token).

FROM alpine:3.21 AS agent-bins
RUN apk add --no-cache curl ca-certificates jq
WORKDIR /out

# Repo that publishes release assets: vortex-agent-linux-amd64 / arm64
ARG AGENT_REPO=vortexssh/vortex-agent
# Tag name, or "latest" for the newest release
ARG AGENT_RELEASE=latest
# Fine-grained PAT with Contents:read (private repo). Pass via compose .env — never commit.
ARG AGENT_GIT_TOKEN=

RUN set -eu; \
  api="https://api.github.com/repos/${AGENT_REPO}/releases"; \
  if [ "${AGENT_RELEASE}" = "latest" ]; then \
    api="${api}/latest"; \
  else \
    api="${api}/tags/${AGENT_RELEASE}"; \
  fi; \
  auth_hdr=""; \
  if [ -n "${AGENT_GIT_TOKEN}" ]; then \
    auth_hdr="Authorization: Bearer ${AGENT_GIT_TOKEN}"; \
  fi; \
  echo "Fetching release metadata: ${api}"; \
  if [ -n "${auth_hdr}" ]; then \
    meta="$(curl -fsSL -H "${auth_hdr}" -H "Accept: application/vnd.github+json" "${api}")"; \
  else \
    meta="$(curl -fsSL -H "Accept: application/vnd.github+json" "${api}")"; \
  fi; \
  for asset in vortex-agent-linux-amd64 vortex-agent-linux-arm64; do \
    url="$(printf '%s' "${meta}" | jq -r --arg n "${asset}" '.assets[] | select(.name==$n) | .url')"; \
    if [ -z "${url}" ] || [ "${url}" = "null" ]; then \
      echo "ERROR: release asset '${asset}' not found in ${AGENT_REPO}@${AGENT_RELEASE}." >&2; \
      echo "Publish assets with: (cd VortexAgent && make cross-linux && gh release upload ...)" >&2; \
      exit 1; \
    fi; \
    echo "Downloading ${asset}"; \
    if [ -n "${auth_hdr}" ]; then \
      curl -fsSL -H "${auth_hdr}" -H "Accept: application/octet-stream" "${url}" -o "/out/${asset}"; \
    else \
      curl -fsSL -H "Accept: application/octet-stream" "${url}" -o "/out/${asset}"; \
    fi; \
    chmod 755 "/out/${asset}"; \
  done

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY src ./src

# Ship shared agent binaries for enroll downloads (<web-origin>/agent/...).
COPY --from=agent-bins /out/vortex-agent-linux-amd64 ./public/agent/vortex-agent-linux-amd64
COPY --from=agent-bins /out/vortex-agent-linux-arm64 ./public/agent/vortex-agent-linux-arm64

ARG VITE_API_URL=https://api.vortex.timant32.ru/api/v1
ARG VITE_WS_URL=wss://api.vortex.timant32.ru/ws
ARG VITE_AGENT_CORE_URL=wss://api.vortex.timant32.ru
ARG VITE_AGENT_BINARY_BASE_URL=
ARG VITE_USE_MSW=false

ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_AGENT_CORE_URL=$VITE_AGENT_CORE_URL \
    VITE_AGENT_BINARY_BASE_URL=$VITE_AGENT_BINARY_BASE_URL \
    VITE_USE_MSW=$VITE_USE_MSW

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
