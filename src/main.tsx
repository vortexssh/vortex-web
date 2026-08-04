import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { USE_MSW } from './config/env'
import { initTheme } from './store/themeStore'

initTheme()

async function prepare(): Promise<void> {
  if (USE_MSW) {
    const { startMockWorker } = await import('./mocks/browser')
    await startMockWorker()
  }
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root not found')
}

void prepare().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
