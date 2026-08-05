import { useCallback, useSyncExternalStore } from 'react'

/**
 * Vrai tant que la requête média tient.
 *
 * `useSyncExternalStore` plutôt qu'un effet : la valeur est connue dès le
 * premier rendu. Avec un effet, la barre s'afficherait une image dans sa forme
 * large avant de se replier, et l'éditeur clignoterait avant d'annoncer sa
 * largeur minimale.
 *
 * Le repli côté serveur répond `false` : sans fenêtre, on ne réduit rien.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** `(max-width: …)` pour une largeur exprimée comme un plancher inclusif. */
export function belowWidth(width: number): string {
  return `(max-width: ${width - 1}px)`
}
