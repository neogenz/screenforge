import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useHistoryStore } from '@/stores/history.store'
import { useUIStore } from '@/stores/ui.store'

if (import.meta.env.DEV) {
  // Dev-only debug handle for e2e state assertions (coalescing, history…).
  ;(window as unknown as { __sfStores?: unknown }).__sfStores = {
    useCanvasStore,
    useProjectStore,
    useHistoryStore,
    useUIStore,
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
