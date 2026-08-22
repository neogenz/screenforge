import type { ReactElement, ReactNode } from 'react'
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip'

export interface HintProps {
  /** Le texte affiché au survol et au focus clavier. */
  content: ReactNode
  /** Un seul élément, qui devient le déclencheur (coss `render`). */
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/**
 * Infobulle de confort : survol ET focus clavier, là où un `title=` natif
 * n'apparaît qu'à la souris. L'action se lit déjà sur le contrôle (icône +
 * `aria-label`) ; jamais d'information indispensable dedans.
 */
export function Hint({ content, children, side = 'bottom', className }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      {/* Base UI ne pose aucun rôle sur le popup : `tooltip` est ce que les
          lecteurs d'écran et les specs attendent. */}
      <TooltipPopup role="tooltip" side={side} className={className}>
        {content}
      </TooltipPopup>
    </Tooltip>
  )
}
