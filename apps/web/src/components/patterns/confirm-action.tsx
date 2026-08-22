import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmActionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /**
   * Le bouton nomme l'objet et sa quantité (« Supprimer 3 écrans »), jamais
   * « OK / Valider / Confirmer » : un menu qui dit « Supprimer » en supprimant
   * trois est le même mensonge dans l'autre sens.
   */
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/** Confirmation d'une action irréversible : `AlertDialog` coss, une seule action primaire. */
export function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  destructive = true,
  onConfirm,
}: ConfirmActionProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup data-slot="confirm-action">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>{cancelLabel}</AlertDialogClose>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
