# syntax=docker/dockerfile:1
# Vortex Web — SPA only. Agent binaries are NOT part of this image.
# Enroll downloads the agent from VITE_AGENT_BINARY_BASE_URL (CDN / GitHub Release / etc.).

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY src ./src

ARG VITE_API_URL=https://api.vortex.timant32.ru/api/v1
ARG VITE_WS_URL=wss://api.vortex.timant32.ru/ws
ARG VITE_AGENT_CORE_URL=wss://api.vortex.timant32.ru
# Absolute URL where vortex-agent-linux-{amd64,arm64} are hosted (required for Install agent).
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
