import type { ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  /** Le texte affiché au survol et au focus clavier. */
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  offset?: number
  className?: string
}

/**
 * Infobulle accessible : survol ET focus clavier, là où un `title=` natif
 * n'apparaît qu'à la souris, après une seconde, sans style possible.
 *
 * Le contenu reste informatif : l'action doit déjà se lire sur le contrôle
 * (icône + `aria-label`), l'infobulle n'ajoute que le confort — raccourci,
 * précision. Jamais d'information indispensable dedans.
 */
export function Tooltip({
  content,
  children,
  side = 'bottom',
  offset = 6,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={offset}
          collisionPadding={8}
          className={cn(
            'menu-shadow z-(--z-toast) animate-menu-in rounded-md border border-border bg-popover px-2 py-1',
            'text-2xs text-foreground',
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
