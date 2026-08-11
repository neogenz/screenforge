import type { DeleteAccountOutcome } from '@/lib/account'
import type { ToastTone } from '@/stores/toast.store'

interface AccountDeletionEffects {
  signOut: () => Promise<void>
  close: () => void
  retry: () => void
  notify: (message: string, tone: ToastTone) => void
}

/** Apply the only UI transition allowed for each server-side deletion state. */
export async function handleAccountDeletionOutcome(
  outcome: DeleteAccountOutcome,
  effects: AccountDeletionEffects,
): Promise<void> {
  if (outcome === 'failed' || outcome === 'unknown') {
    effects.retry()
    effects.notify(
      outcome === 'failed'
        ? 'La suppression a échoué. Le compte reste actif.'
        : 'Impossible de confirmer la suppression. Rechargez la page avant de réessayer.',
      'error',
    )
    return
  }

  await effects.signOut()
  effects.close()
  if (outcome === 'deletion-pending') {
    effects.notify(
      'Suppression en cours. Le compte sera effacé automatiquement ; vos projets locaux restent disponibles.',
      'info',
    )
    return
  }
  effects.notify(
    outcome === 'cleanup-pending'
      ? 'Compte supprimé. Le nettoyage cloud restant reprendra automatiquement.'
      : 'Compte supprimé. Vos projets restent sur cette machine.',
    outcome === 'cleanup-pending' ? 'info' : 'success',
  )
}
