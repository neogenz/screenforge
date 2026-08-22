import type { ReactNode, RefObject } from 'react'
import { Popover, PopoverPopup } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface AnchoredPopoverProps {
  open: boolean
  /** L'élément qui a ouvert le panneau ; son propre `onClick` bascule l'ouverture. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end' | 'center'
  side?: 'bottom' | 'top'
  offset?: number
  className?: string
  role?: string
  ariaLabel?: string
  /**
   * Prend Échap à son compte : un panneau d'édition distingue « dehors valide »
   * de « Échap annule », et Base UI nomme la raison de chaque fermeture.
   */
  onEscape?: () => void
}

/** Panneau flottant coss ancré sur un déclencheur qui vit hors de l'arbre Popover. */
export function AnchoredPopover({
  open,
  anchor,
  onClose,
  children,
  align = 'start',
  side = 'bottom',
  offset = 6,
  className,
  role,
  ariaLabel,
  onEscape,
}: AnchoredPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={(isOpen, details) => {
        if (isOpen) return
        if (details.reason === 'outside-press') {
          const target = details.event.target
          // Le déclencheur bascule déjà l'ouverture : le press dehors ne doit
          // pas aussi fermer le panneau, sinon il se rouvre au même clic.
          if (target instanceof Node && anchor.current?.contains(target)) return
        }
        if (details.reason === 'escape-key' && onEscape) {
          onEscape()
          return
        }
        onClose()
      }}
    >
      <PopoverPopup
        anchor={anchor}
        side={side}
        align={align}
        sideOffset={offset}
        initialFocus={false}
        role={role}
        aria-label={ariaLabel}
        data-slot="anchored-popover"
        className={cn('**:data-[slot=popover-viewport]:p-0', className)}
      >
        {children}
      </PopoverPopup>
    </Popover>
  )
}
