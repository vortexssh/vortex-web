# syntax=docker/dockerfile:1
#
# Build from monorepo parent (VortexSSH/):
#   docker compose -f VortexWeb/docker-compose.yml build
# Context includes VortexAgent so enroll scripts can auto-download binaries from /agent/.

FROM golang:1.24-bookworm AS agent
WORKDIR /src
ENV GOTOOLCHAIN=auto
RUN apt-get update && apt-get install -y --no-install-recommends make \
  && rm -rf /var/lib/apt/lists/*
COPY VortexAgent/go.mod VortexAgent/go.sum ./
RUN go mod download
COPY VortexAgent/ ./
RUN make cross-linux \
  && mkdir -p /out \
  && cp bin/vortex-agent-linux-amd64 bin/vortex-agent-linux-arm64 /out/

FROM node:22-alpine AS build
WORKDIR /app

COPY VortexWeb/package.json VortexWeb/package-lock.json ./
RUN npm ci

COPY VortexWeb/index.html ./
COPY VortexWeb/public ./public
COPY VortexWeb/tsconfig.json VortexWeb/tsconfig.app.json VortexWeb/tsconfig.node.json ./
COPY VortexWeb/vite.config.ts ./
COPY VortexWeb/src ./src

# Auto-ship agent binaries at /agent/* (no VITE_AGENT_BINARY_BASE_URL required).
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
COPY VortexWeb/deploy/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
