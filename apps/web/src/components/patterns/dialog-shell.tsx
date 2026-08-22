import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { IconButton } from '@/components/patterns/icon-button'
import { cn } from '@/lib/utils'

export interface DialogShellProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Ce que l'action implique, dit là où on la lance — à gauche du pied, passe à la ligne. */
  footerNote?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Retour d'une sous-vue, avant le titre — le titre reste le nom stable de la boîte. */
  back?: { label: string; onBack: () => void; disabled?: boolean }
  /** Extra content on the right side of the header, before the close button. */
  headerActions?: ReactNode
  /** Contenu à fleur de bord, pour une boîte qui pose elle-même ses colonnes. */
  flush?: boolean
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

/**
 * L'anatomie coss Header / Panel / Footer, avec ce que toutes les boîtes de
 * ScreenForge partagent : un retour, des actions d'en-tête, une note de pied.
 */
export function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  footerNote,
  size = 'md',
  back,
  headerActions,
  flush = false,
}: DialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogPopup
        data-slot="dialog-shell"
        className={cn('max-h-[85dvh]', SIZES[size])}
        closeProps={{ 'aria-label': 'Fermer' }}
      >
        <DialogHeader className={cn((back || headerActions) && 'flex-row items-center gap-2')}>
          {back && (
            <IconButton
              aria-label={back.label}
              tooltip={back.label}
              size="sm"
              disabled={back.disabled}
              onClick={back.onBack}
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="min-w-0 break-words">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
          {headerActions && (
            <div className="me-9 flex shrink-0 items-center gap-1">{headerActions}</div>
          )}
        </DialogHeader>
        <DialogPanel className={cn(flush && 'p-0')}>{children}</DialogPanel>
        {(footer || footerNote) && (
          <DialogFooter className="flex-wrap gap-y-2">
            {footerNote && (
              <p className="me-auto min-w-0 text-xs text-muted-foreground">{footerNote}</p>
            )}
            {footer}
          </DialogFooter>
        )}
      </DialogPopup>
    </Dialog>
  )
}
