# syntax=docker/dockerfile:1
#
# Standalone build (production):
#   cd /opt/vortex-web && docker compose up -d --build
#
# Agent source is NOT cloned from GitHub during build (repo is private).
# Compose mounts it via additional_contexts from VORTEX_AGENT_SRC
# (default: /opt/vortex-agent — clone once next to vortex-web).

FROM golang:1.24-bookworm AS agent
WORKDIR /src
ENV GOTOOLCHAIN=auto

RUN apt-get update && apt-get install -y --no-install-recommends make \
  && rm -rf /var/lib/apt/lists/*

# Provided by docker-compose additional_contexts: vortex-agent
COPY --from=vortex-agent . ./

RUN test -f go.mod || (echo "ERROR: vortex-agent context empty. Clone agent to /opt/vortex-agent (see DEPLOY.md)." >&2; exit 1)
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

COPY --from=agent /out/vortex-agent-linux-amd64 ./public/agent/vortex-agent-linux-amd64
COPY --from=agent /out/vortex-agent-linux-arm64 ./public/agent/vortex-agent-linux-arm64

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
