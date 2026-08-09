import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { createPortalSession, deleteAccount } from '@/lib/api'
import { handleAccountDeletionOutcome } from '@/lib/account-deletion-ui'
import { signOut, signOutAndReport } from '@/lib/auth'
import { formatGrantDate } from '@/lib/plans'
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

  const licence = entitlements?.licence ?? false
  const cloud = entitlements?.cloud ?? false

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
          useAuthStore.getState().setSession(null)
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

        <div className="flex flex-col">
          <EntitlementRow
            name="Licence"
            /* Perpétuelle : une date d'acquisition et rien après. */
            state={
              licence
                ? (dateLabel('Acquise le', entitlements?.licenceGrantedAt) ?? 'Acquise')
                : null
            }
            onBuy={() => setShowPricingDialog(true)}
            buyLabel="Acheter la Licence"
          />
          <EntitlementRow
            name="Cloud"
            /* Abonnement : une échéance, qui est la date de renouvellement tant
               qu'il court et la date de fin dès qu'il est résilié. */
            state={cloud ? (dateLabel('Jusqu’au', entitlements?.cloudPeriodEnd) ?? 'Actif') : null}
            lockedReason={licence ? undefined : 'Nécessite la Licence'}
            onBuy={() => setShowPricingDialog(true)}
            buyLabel="Ajouter le Cloud"
          />
        </div>

        <div className="flex flex-col gap-2">
          {/* Le portail n'apparaît qu'à qui a quelque chose à y voir : chez un
              compte sans achat, il n'ouvre qu'une page vide. */}
          {licence && (
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

interface EntitlementRowProps {
  name: string
  /** L'état détenu, ou `null` quand il reste à acheter. */
  state: string | null
  lockedReason?: string
  buyLabel: string
  onBuy: () => void
}

/**
 * Un droit par ligne, avec sa forme propre.
 *
 * La Licence et le Cloud ne se résument pas au même mot : l'une porte le jour
 * où elle a été acquise, l'autre le jour où il s'arrête. Un unique libellé
 * « actif » pour les deux effacerait précisément ce que l'utilisateur vient
 * vérifier après une résiliation.
 */
function EntitlementRow({ name, state, lockedReason, buyLabel, onBuy }: EntitlementRowProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border py-1.5 first:border-t-0">
      <span className="text-sm text-foreground">{name}</span>
      {state ? (
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Check size={12} strokeWidth={2} aria-hidden className="shrink-0" />
          {state}
        </span>
      ) : lockedReason ? (
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Lock size={12} strokeWidth={2} aria-hidden className="shrink-0" />
          {lockedReason}
        </span>
      ) : (
        <Button variant="default" size="sm" onClick={onBuy}>
          {buyLabel}
        </Button>
      )}
    </div>
  )
}
