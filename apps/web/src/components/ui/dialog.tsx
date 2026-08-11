import { useRef } from 'react'
import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { belowWidth, useMediaQuery } from '@/hooks/use-media-query'
import { DIALOG_SIDEBAR_WIDTH, DIALOG_STACK_MIN_WIDTH } from '@/lib/stage'
import { IconButton } from '@/components/ui/icon-button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /**
   * Ce que l'action implique, dit là où on la lance.
   *
   * Portée par la boîte plutôt que par chaque pied : les cinq du cycle de vie
   * rebâtissaient la même rangée « phrase à gauche, actions à droite », et
   * aucune ne passait à la ligne — à 375px la paire de boutons sortait du
   * cadre, sans que rien ne le dise.
   */
  footerNote?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Extra content on the right side of the header, before the close button. */
  headerActions?: ReactNode
  /**
   * Contenu à fleur de bord, pour une boîte qui pose elle-même ses colonnes.
   * Annulait son retrait par une marge négative, qui n'a jamais valu le retrait.
   */
  flush?: boolean
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

/** Modal dialog: Radix portal, scrim, focus trap, Escape, focus return. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  footerNote,
  size = 'md',
  headerActions,
  flush = false,
}: DialogProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-modal) animate-fade-in bg-black/50" />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
            // À défaut de cible désignée, c'est le panneau qui prend le focus, pas le
            // premier bouton venu : la croix de fermeture se retrouvait cerclée
            // d'accent à l'ouverture, soit l'élément le plus voyant de la boîte.
            event.preventDefault()
            const panel = contentRef.current
            const autofocus = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
            autofocus?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const target = returnFocusRef.current
            returnFocusRef.current = null
            if (target?.isConnected) target.focus()
          }}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className={cn(
            'surface-modal fixed left-1/2 top-1/2 z-(--z-modal) flex max-h-[85dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 animate-slide-up flex-col overflow-hidden',
            'focus:outline-none',
            SIZES[size],
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="panel-title">{title}</DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              {headerActions}
              <IconButton aria-label="Fermer" title="Fermer (Échap)" onClick={onClose} size="sm">
                <X size={15} strokeWidth={1.75} />
              </IconButton>
            </div>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto', !flush && 'p-6')}>{children}</div>
          {(footer || footerNote) && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-border px-6 py-4">
              {footerNote && (
                <p className="mr-auto min-w-0 text-2xs text-muted-foreground">{footerNote}</p>
              )}
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export interface DialogColumnsProps {
  /** Nom accessible de la colonne de liste. */
  label: string
  /** Nom accessible de la colonne de contenu, quand elle en mérite un. */
  contentLabel?: string
  list: ReactNode
  children: ReactNode
}

/**
 * Une liste et ce qu'elle sélectionne, côte à côte tant qu'il y a la place.
 *
 * Sous `DIALOG_STACK_MIN_WIDTH` les deux s'empilent, et c'est la boîte qui
 * défile au lieu de chaque colonne : deux boîtes à défilement l'une sur
 * l'autre dans une fenêtre étroite, c'est un contenu qu'on ne peut plus
 * atteindre sans deviner laquelle porte la barre. Le seuil se lit par
 * `useMediaQuery` — écrit en dur dans une classe utilitaire, il aurait été
 * recopié de travers par la troisième boîte qui en a besoin.
 */
export function DialogColumns({ label, contentLabel, list, children }: DialogColumnsProps) {
  const stacked = useMediaQuery(belowWidth(DIALOG_STACK_MIN_WIDTH))
  return (
    <div
      data-dialog-columns
      className="grid"
      style={{
        gridTemplateColumns: stacked
          ? 'minmax(0,1fr)'
          : `minmax(0,${DIALOG_SIDEBAR_WIDTH}px) minmax(0,1fr)`,
      }}
    >
      <aside
        aria-label={label}
        className={cn(
          'flex flex-col gap-3 border-border px-4 py-4',
          stacked ? 'border-b' : 'max-h-[56dvh] overflow-y-auto border-r',
        )}
      >
        {list}
      </aside>
      <section
        aria-label={contentLabel}
        className={cn('flex flex-col gap-4 px-6 py-4', !stacked && 'max-h-[56dvh] overflow-y-auto')}
      >
        {children}
      </section>
    </div>
  )
}
