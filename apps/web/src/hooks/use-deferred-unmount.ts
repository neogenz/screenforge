import { useEffect, useState } from 'react'

/**
 * Garde un panneau monté le temps de sa transition de sortie, puis le démonte.
 *
 * Un drawer fermé mais monté reste abonné aux stores et focusable sous
 * `aria-hidden` : chaque scrub du canvas le re-rend pour rien et Tab peut
 * tomber dedans. La transition dure 200 ms (voir les drawers) — on laisse
 * 220 ms avant de couper.
 */
export function useDeferredUnmount(open: boolean, exitMs = 220): boolean {
  const [mounted, setMounted] = useState(open)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    // Remontage dérivé pendant le rendu : la frame d'ouverture a besoin du
    // panneau tout de suite, pas au tick d'effet suivant.
    setWasOpen(open)
    if (open) setMounted(true)
  }
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [open, exitMs])
  return mounted
}
