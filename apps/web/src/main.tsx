import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAuthStore } from '@/stores/auth.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useHistoryStore } from '@/stores/history.store'
import { useUIStore } from '@/stores/ui.store'
import * as assets from '@/lib/assets'
import { readBootTheme } from '@/lib/user-settings'

// Le sombre est la classe `.dark`, le clair son absence (convention coss et
// Base UI). `boot.js` l'a déjà posée avant la feuille de styles ; la reposer
// ici couvre le cas où le script de boot n'a pas tourné.
document.documentElement.classList.toggle('dark', readBootTheme() === 'dark')

if (import.meta.env.DEV) {
  // Dev-only debug handle for e2e state assertions (coalescing, history…).
  // `useAuthStore` y est aussi en écriture : les droits arrivent normalement
  // d'un achat Polar, et une suite e2e ne peut pas en passer un. Poser le droit
  // Cloud ici est le seul moyen de tester la sync sans
  // faire dépendre la suite d'un compte, d'un backend et d'un tiers payant.
  ;(window as unknown as { __sfStores?: unknown }).__sfStores = {
    useAuthStore,
    useCanvasStore,
    useProjectStore,
    useHistoryStore,
    useUIStore,
  }
  // Le registre d'assets, exposé pour la même raison que les stores : il est
  // mutable, et un test qui l'importerait par URL depuis la page en obtiendrait
  // une seconde instance dès que Vite horodate le spécificateur après un HMR.
  ;(window as unknown as { __sfAssets?: unknown }).__sfAssets = assets
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
