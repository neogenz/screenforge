import { useEffect, useState, type RefObject } from 'react'

/*
 * Ce que les deux figures qui se jouent (l'agent, le rafraîchissement) ont en
 * commun côté scénario : savoir si elles sont à l'écran, attendre, compter
 * les écrans. Le dessin est dans `session-figure.tsx`.
 */

export type StepState = 'pending' | 'running' | 'done'

export const SCREENS = 10

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* Une figure se joue quand elle est visible, et seulement là : le seuil est
   bas (0.4) parce qu'elle est courte et que la première étape se lit dès le
   haut de la carte. */
export function useInView(ref: RefObject<Element | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.4,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}
