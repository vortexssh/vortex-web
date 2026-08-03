# syntax=docker/dockerfile:1
#
# Standalone build (production):
#   cd /opt/vortex-web && docker compose up -d --build
#
# Agent binaries are compiled during image build (auto) from vortex-agent git
# and served at /agent/vortex-agent-linux-{amd64,arm64}.

FROM golang:1.24-bookworm AS agent
WORKDIR /src
ENV GOTOOLCHAIN=auto

ARG AGENT_GIT_URL=https://github.com/vortexssh/vortex-agent.git
ARG AGENT_GIT_REF=master
# Optional: GitHub PAT for private vortex-agent (pass via compose build-arg / .env — never commit).
ARG AGENT_GIT_TOKEN=

RUN apt-get update && apt-get install -y --no-install-recommends make git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN set -eu; \
  url="${AGENT_GIT_URL}"; \
  if [ -n "${AGENT_GIT_TOKEN}" ]; then \
    url="https://${AGENT_GIT_TOKEN}@github.com/vortexssh/vortex-agent.git"; \
  fi; \
  echo "cloning agent from ${AGENT_GIT_URL}@${AGENT_GIT_REF}"; \
  git clone --depth 1 --branch "${AGENT_GIT_REF}" "${url}" .; \
  git remote set-url origin "${AGENT_GIT_URL}" 2>/dev/null || true

RUN make cross-linux \
  && mkdir -p /out \
  && cp bin/vortex-agent-linux-amd64 bin/vortex-agent-linux-arm64 /out/

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY src ./src

# Auto-ship agent binaries at /agent/* (enroll scripts download from <web-origin>/agent/).
COPY --from=agent /out/vortex-agent-linux-amd64 ./public/agent/vortex-agent-linux-amd64
COPY --from=agent /out/vortex-agent-linux-arm64 ./public/agent/vortex-agent-linux-arm64

ARG VITE_API_URL=https://api.vortex.timant32.ru/api/v1
ARG VITE_WS_URL=wss://api.vortex.timant32.ru/ws
ARG VITE_AGENT_CORE_URL=wss://api.vortex.timant32.ru
# Leave empty → browser uses window.location.origin + /agent at enroll time.
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
