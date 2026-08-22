import { createElement } from 'react'
import { toast as sonner } from 'sonner'

export type ToastTone = 'info' | 'success' | 'error'

/**
 * La coche de succès, dessinée plutôt qu'apparue : le succès est le seul toast
 * qui confirme un geste de l'utilisateur, il mérite une fin. Le trait joue
 * `--animate-check-draw`, que `prefers-reduced-motion` neutralise comme les
 * autres.
 */
function CheckDrawn() {
  return createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 14 14',
      fill: 'none',
      'aria-hidden': true,
      className: 'text-success',
    },
    createElement('path', {
      d: 'M2.5 7.5l3 3 6-6.5',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDasharray: 14,
      className: 'animate-check-draw',
    }),
  )
}

/**
 * Deux toasts identiques d'affilée rejouent : sonner monte un nouveau nœud à
 * chaque appel, mais partant toujours de la même classe `animate-toast-*` un
 * navigateur pourrait fusionner les deux animations si jamais un id venait à
 * se répéter. Le compteur alterne `-odd`/`-even` par ton, deux classes aux
 * mêmes images mais nommées différemment, pour que `animationstart` reparte
 * de zéro à coup sûr.
 */
const replayCounters: Record<'success' | 'error', number> = { success: 0, error: 0 }

function replayClassName(tone: ToastTone): string | undefined {
  if (tone === 'info') return undefined
  const count = ++replayCounters[tone]
  return `animate-toast-${tone}-${count % 2 === 0 ? 'even' : 'odd'}`
}

interface ToastOptions {
  duration?: number
  /**
   * Le rattrapage d'un échec, là où l'échec est annoncé.
   *
   * Une panne de synchronisation n'a pas d'écran à elle : sans ce bouton, la
   * seule reprise offerte serait de modifier quelque chose pour re-déclencher un
   * cycle, ce qui demande à l'utilisateur de deviner la mécanique.
   */
  action?: { label: string; onClick: () => void }
}

/** Fire-and-forget toast, callable from anywhere (stores, hooks, commands). */
export function toast(message: string, tone: ToastTone = 'info', options?: ToastOptions) {
  // Le rôle vit dans le contenu : sonner n'en pose pas sur le toast lui-même,
  // et les tests comme les lecteurs d'écran s'appuient sur status/alert.
  const content = createElement('span', { role: tone === 'error' ? 'alert' : 'status' }, message)
  /* Un toast qui propose une action ne s'efface plus tout seul : « Réessayer »
     doit être atteignable au clavier, et 3,5 s ne suffisent ni à lire l'échec
     ni à tabber jusqu'au bouton. */
  const resolved =
    options?.action && options.duration === undefined ? { ...options, duration: Infinity } : options
  const className = replayClassName(tone)
  if (tone === 'success')
    sonner.success(content, { icon: createElement(CheckDrawn), className, ...resolved })
  else if (tone === 'error') sonner.error(content, { className, ...resolved })
  else sonner.info(content, resolved)
}
