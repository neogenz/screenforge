import { useRef } from 'react'
import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/icon-button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Extra content on the right side of the header, before the close button. */
  headerActions?: ReactNode
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
  size = 'md',
  headerActions,
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
            returnFocusRef.current = document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
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
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="panel-title">
              {title}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              {headerActions}
              <IconButton aria-label="Fermer" title="Fermer (Échap)" onClick={onClose} size="sm">
                <X size={15} strokeWidth={1.75} />
              </IconButton>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
