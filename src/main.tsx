import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
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

export function RootApp() {
  const [crashed, setCrashed] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debugWindow = window as unknown as { __sfCrash?: () => void }
    const crash = () => setCrashed(true)
    debugWindow.__sfCrash = crash
    return () => {
      if (debugWindow.__sfCrash === crash) delete debugWindow.__sfCrash
    }
  }, [])

  if (crashed) throw new Error('Development rendering crash.')
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootApp />
    </ErrorBoundary>
  </StrictMode>,
)
