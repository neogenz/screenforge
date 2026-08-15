import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { createPortalSession, deleteAccount } from '@/lib/account'
import { handleAccountDeletionOutcome } from '@/lib/account-deletion-ui'
import { signOut, signOutAndReport } from '@/lib/auth'
import { formatGrantDate, planName } from '@/lib/plans'
import { ensureDurableStorage } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'

export function AccountDialog() {
  const showAccountDialog = useUIStore((s) => s.showAccountDialog)

  if (!showAccountDialog) return null
  return <AccountDialogContent />
}

/**
 * Un seul endroit pour tout ce qui concerne le compte.
 *
 * L'achat n'est pas ici : les deux droits y sont montrés mais s'achètent dans
 * la boîte des offres, qui porte déjà les prix, les arguments et le checkout.
 * Dupliquer un bouton d'achat ici ferait deux chemins de paiement à tenir
 * d'accord, et le second aurait forcément moins de contexte que le premier.
 */
function AccountDialogContent() {
  const setShowAccountDialog = useUIStore((s) => s.setShowAccountDialog)
  const setShowPricingDialog = useUIStore((s) => s.setShowPricingDialog)
  const email = useAuthStore((s) => s.user?.email ?? null)
  const entitlements = useAuthStore((s) => s.entitlements)
  /** Quel geste attend, pas un booléen : trois boutons partagent la boîte. */
  const [pending, setPending] = useState<'portal' | 'delete' | null>(null)
  /**
   * La suppression se demande deux fois.
   *
   * En deux temps sur le même bouton plutôt qu'en boîte imbriquée : la seconde
   * dialog reprendrait le focus, et un `confirm()` natif est la seule surface
   * du produit qu'aucun de ses tokens n'atteint. Le second état écrit la
   * conséquence — c'est elle qu'on lit, pas le mot « confirmer ».
   */
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /**
   * Le navigateur s'est-il engagé à garder les projets ?
   *
   * `null` tant qu'on ne sait pas : la question est asynchrone, et afficher
   * l'avertissement pendant qu'elle se pose le ferait clignoter chez ceux qu'il
   * ne concerne pas. Il n'est dit qu'au négatif, et l'ignorance n'est pas un
   * négatif.
   */
  const [durable, setDurable] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void ensureDurableStorage().then((granted) => {
      if (live) setDurable(granted)
    })
    return () => {
      live = false
    }
  }, [])

  const localPurchased = Boolean(entitlements?.licenceGrantedAt)
  const cloud = entitlements?.cloud ?? false
  const hasBillingHistory = localPurchased || Boolean(entitlements?.cloudStatus)
  const currentPlan = planName(entitlements)
  const cloudEnd = dateLabel('Actif jusqu’au', entitlements?.cloudPeriodEnd)
  const localSince = dateLabel('Acquis le', entitlements?.licenceGrantedAt)
  const planDetail = cloud
    ? `${cloudEnd ?? 'Actif'} · inclut Local${localPurchased ? ' · Local restera acquis après Cloud' : ''}`
    : localPurchased
      ? (localSince ?? 'Achat perpétuel')
      : 'Trois exports filigranés par projet avant achat'

  function openPricing() {
    setShowAccountDialog(false)
    setShowPricingDialog(true)
  }

  async function openPortal() {
    setPending('portal')
    const url = await createPortalSession()
    if (url) {
      window.location.assign(url)
      return
    }
    setPending(null)
    toast('Le portail de facturation est indisponible.', 'error')
  }

  async function confirmDelete() {
    setPending('delete')
    const outcome = await deleteAccount()
    await handleAccountDeletionOutcome(outcome, {
      signOut: async () => {
        /* Même si le SDK ne peut plus joindre une identité déjà effacée, le
           store doit quitter immédiatement le mode cloud. */
        try {
          await signOut()
        } catch (error) {
          console.warn('Could not revoke the deleted account session.', error)
        } finally {
          useAuthStore.getState().setUser(null)
        }
      },
      close: () => setShowAccountDialog(false),
      retry: () => {
        setPending(null)
        setConfirmingDelete(false)
      },
      notify: toast,
    })
  }

  return (
    <Dialog open onClose={() => setShowAccountDialog(false)} title="Compte" size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {/* L'initiale plutôt qu'une image : le fournisseur d'identité peut
              n'en donner aucune, et une silhouette générique n'identifierait
              pas plus le compte que le vide. */}
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-2xs font-semibold text-foreground uppercase"
          >
            {email?.[0] ?? '?'}
          </span>
          <p className="min-w-0 truncate text-sm text-foreground">{email ?? 'Session en cours'}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="field-label">Plan actuel</p>
          <div className="mt-1.5 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{currentPlan}</h3>
            {currentPlan !== 'Essai' && (
              <Check size={13} strokeWidth={2} aria-label="Actif" className="text-marker" />
            )}
          </div>
          <p className="mt-1 text-2xs leading-4 text-muted-foreground">{planDetail}</p>
          {cloud && (
            <p className="mt-2 border-t border-border pt-2 text-2xs leading-4 text-muted-foreground">
              Synchronisation : projets, images et thème sur chaque machine.
            </p>
          )}
          {!cloud && (
            <Button variant="default" size="sm" className="mt-3 w-full" onClick={openPricing}>
              {localPurchased ? 'Passer au Cloud' : 'Voir Local et Cloud'}
            </Button>
          )}

          {!cloud && durable === false && (
            <p className="mt-2 border-t border-border pt-2 text-2xs leading-4 text-muted-foreground">
              Vos projets vivent dans ce navigateur, qui n’a pas garanti de les conserver.
              Téléchargez-en une copie depuis le menu du projet, ou choisissez Cloud.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* Le portail n'apparaît qu'à qui a quelque chose à y voir : chez un
              compte sans achat, il n'ouvre qu'une page vide. */}
          {hasBillingHistory && (
            <Button
              variant="default"
              className="w-full"
              loading={pending === 'portal'}
              disabled={pending !== null}
              onClick={() => void openPortal()}
            >
              Factures et paiement
            </Button>
          )}
          <Button
            variant="default"
            className="w-full"
            disabled={pending !== null}
            onClick={() => {
              setShowAccountDialog(false)
              void signOutAndReport()
            }}
          >
            Se déconnecter
          </Button>
        </div>

        <div className="hairline" />

        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            className="w-full"
            loading={pending === 'delete'}
            disabled={pending !== null}
            onClick={() => {
              if (confirmingDelete) void confirmDelete()
              else setConfirmingDelete(true)
            }}
          >
            {confirmingDelete ? 'Confirmer la suppression' : 'Supprimer mon compte'}
          </Button>
          {confirmingDelete && (
            <p role="alert" className="text-2xs leading-4 text-muted-foreground">
              Le compte, les droits achetés et les projets synchronisés seront effacés
              définitivement. Les projets de cette machine sont conservés.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function dateLabel(prefix: string, iso: string | null | undefined): string | null {
  const date = formatGrantDate(iso ?? null)
  return date ? `${prefix} ${date}` : null
}
