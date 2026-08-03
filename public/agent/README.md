# Local/dev only

`cd ../VortexAgent && make publish-web` → files here → Vite serves `/agent/...`.

Production enroll does **not** use this folder; set `VITE_AGENT_BINARY_BASE_URL` on the Web build.
