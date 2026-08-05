import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Landing } from './Landing'
import { initLang } from './i18n'
import './landing.css'

initLang()

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <Landing />
  </StrictMode>
)

/* Pré-rempli par le prerender au build → hydratation ; vide en dev → rendu client. */
if (root.hasChildNodes()) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
