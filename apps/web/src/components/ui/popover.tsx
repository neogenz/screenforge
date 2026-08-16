import { useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export interface PopoverProps {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  offset?: number
  className?: string
  role?: string
  ariaLabel?: string
  /**
   * Prend Échap à son compte, au lieu de la laisser fermer par la voie commune.
   *
   * Sans ça, la touche congédie le panneau par le même chemin qu'un clic
   * dehors : `onClose` reçoit les deux et ne peut pas les distinguer. Un
   * panneau d'édition en a besoin — dehors valide, Échap annule — et un drapeau
   * posé dans l'`onKeyDown` du champ arrive trop tard, Radix écoute la touche
   * en phase de capture sur le document, donc avant React.
   */
  onEscape?: () => void
}

/** Anchored floating panel: Radix popper over a virtual anchor, collision-clamped. */
export function Popover({
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
}: PopoverProps) {
  const virtualRef = useRef({
    getBoundingClientRect: () => anchor.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0),
  })

  function handleOutside(event: { target: unknown; preventDefault: () => void }) {
    // Le déclencheur vit hors de l'arbre Radix : son propre onClick bascule
    // l'ouverture, le press extérieur ne doit pas aussi fermer le panneau.
    if (anchor.current?.contains(event.target as Node)) event.preventDefault()
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role={role}
          aria-label={ariaLabel}
          align={align}
          side={side}
          sideOffset={offset}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.stopPropagation()
            if (!onEscape) return
            event.preventDefault()
            onEscape()
          }}
          onPointerDownOutside={handleOutside}
          onInteractOutside={handleOutside}
          className={cn(
            // Même grammaire que Dropdown et ContextMenu : rayon lg, ombre menu, fond panneau.
            'menu-shadow z-(--z-popover) animate-menu-in overflow-hidden rounded-lg border border-border bg-popover',
            side === 'bottom' ? 'origin-top' : 'origin-bottom',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
