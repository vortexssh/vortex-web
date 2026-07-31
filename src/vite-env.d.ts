/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_USE_MSW?: string
  /** Outbound agent Core base, e.g. wss://core.example.com */
  readonly VITE_AGENT_CORE_URL?: string
  /** CDN/base that hosts vortex-agent-linux-amd64 artifacts from `make cross` */
  readonly VITE_AGENT_BINARY_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
