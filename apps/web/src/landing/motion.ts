/*
 * Grammaire motion de la landing : la même que l'app (ease-out expo court,
 * transform/opacité uniquement), plus un stagger pour le reveal initial.
 * Un reveal se joue une fois par section — jamais de parallaxe ni d'effet
 * continu au scroll.
 */
export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const REVEAL_DURATION_MS = 220
export const REVEAL_STAGGER_MS = 80

import { useSyncExternalStore } from 'react'

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/* Media query via useSyncExternalStore : le serveur rend « false » (scène
   initiale complète dans le HTML), le client reduced-motion bascule après
   hydratation — sans mismatch, sans setState dans un effet. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}
