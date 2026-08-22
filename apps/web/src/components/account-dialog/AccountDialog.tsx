import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmAction } from '@/components/patterns/confirm-action'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { PanelSection } from '@/components/patterns/panel-section'
import { createPortalSession, deleteAccount } from '@/lib/account'
import { handleAccountDeletionOutcome } from '@/lib/account-deletion-ui'
import { signOut, signOutAndReport } from '@/lib/auth'
import { formatGrantDate, planName } from '@/lib/plans'
import { fetchRemoteCloudUsage, type CloudUsage, type CloudUsageRow } from '@/lib/cloud'
import { cloudUsageState, formatCloudBytes, type CloudUsageState } from '@/lib/cloud-usage'
import { clearCloudCopy } from '@/lib/sync'
import { afterProjectSaved, ensureDurableStorage } from '@/lib/storage'
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
 * L'achat n'est pas ici : Cloud se choisit dans la boîte des offres, qui porte
 * déjà le prix, les arguments et le checkout.
 * Dupliquer un bouton d'achat ici ferait deux chemins de paiement à tenir
 * d'accord, et le second aurait forcément moins de contexte que le premier.
 */
function AccountDialogContent() {
  const setShowAccountDialog = useUIStore((s) => s.setShowAccountDialog)
  const setShowPricingDialog = useUIStore((s) => s.setShowPricingDialog)
  const email = useAuthStore((s) => s.user?.email ?? null)
  const entitlements = useAuthStore((s) => s.entitlements)
  /** Quel geste attend, pas un booléen : trois boutons partagent la boîte. */
  const [pending, setPending] = useState<'portal' | 'clear-cloud' | 'delete' | null>(null)
  /** Ouvre le `ConfirmAction` de suppression du compte. */
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  /**
   * Le navigateur s'est-il engagé à garder les projets ?
   *
   * `null` tant qu'on ne sait pas : la question est asynchrone, et afficher
   * l'avertissement pendant qu'elle se pose le ferait clignoter chez ceux qu'il
   * ne concerne pas. Il n'est dit qu'au négatif, et l'ignorance n'est pas un
   * négatif.
   */
  const [durable, setDurable] = useState<boolean | null>(null)
  const cloud = entitlements?.cloud ?? false
  const hasBillingHistory = Boolean(entitlements?.cloudStatus)
  const showCloudData = cloud || hasBillingHistory
  const [usage, setUsage] = useState<CloudUsage | 'loading' | 'error'>('loading')
  useEffect(() => {
    let live = true
    void ensureDurableStorage().then((granted) => {
      if (live) setDurable(granted)
    })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (!showCloudData) return
    let live = true
    void fetchRemoteCloudUsage().then(
      (value) => {
        if (live) setUsage(value ?? 'error')
      },
      () => {
        if (live) setUsage('error')
      },
    )
    return () => {
      live = false
    }
  }, [showCloudData])
  const currentPlan = planName(entitlements)
  const cloudEnd = dateLabel('Actif jusqu’au', entitlements?.cloudPeriodEnd)
  const planDetail = cloud
    ? `${cloudEnd ?? 'Actif'} · synchronisation et stockage managés`
    : 'Gratuit · exports propres et ZIP illimités sans compte'

  function openPricing() {
    setShowAccountDialog(false)
    setShowPricingDialog(true)
  }

  async function openPortal() {
    setPending('portal')
    const url = await createPortalSession()
    if (url) {
      try {
        await afterProjectSaved(() => window.location.assign(url))
      } catch {
        setPending(null)
      }
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
      /* `ConfirmAction` s'est déjà refermé au clic : il n'y a plus qu'à
         rendre les autres actions du compte, l'échec est notifié par toast. */
      retry: () => setPending(null),
      notify: toast,
    })
  }

  async function confirmClearCloud() {
    setPending('clear-cloud')
    const outcome = await clearCloudCopy()
    if (outcome === 'cleared') {
      const next = await fetchRemoteCloudUsage().catch(() => null)
      setUsage(next ?? 'error')
      setConfirmingClear(false)
      toast('La copie Cloud est effacée. Vos projets restent sur cet appareil.', 'info')
    } else {
      toast(
        outcome === 'incomplete'
          ? 'Le nettoyage Cloud doit être repris.'
          : 'Le résultat du nettoyage Cloud est incertain. Vérifiez puis réessayez.',
        'error',
      )
    }
    setPending(null)
  }

  return (
    <DialogShell open onClose={() => setShowAccountDialog(false)} title="Compte" size="sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 pb-3">
          {/* L'initiale plutôt qu'une image : le fournisseur d'identité peut
              n'en donner aucune, et une silhouette générique n'identifierait
              pas plus le compte que le vide. */}
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground uppercase"
          >
            {email?.[0] ?? '?'}
          </span>
          <p className="min-w-0 truncate text-sm text-foreground">{email ?? 'Session en cours'}</p>
        </div>

        {showCloudData && (
          <PanelSection title="Utilisation Cloud">
            <CloudUsagePanel usage={usage} />
            {confirmingClear ? (
              <div className="flex flex-col gap-2">
                <p role="alert" className="text-xs leading-4 text-muted-foreground">
                  Les projets de cet appareil, votre compte et votre abonnement restent en place.
                  Les copies uniquement présentes dans Cloud ou sur d’autres machines ne seront plus
                  récupérables depuis Cloud.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => setConfirmingClear(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    loading={pending === 'clear-cloud'}
                    disabled={pending !== null}
                    onClick={() => void confirmClearCloud()}
                  >
                    Effacer la copie
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive-outline"
                size="sm"
                className="w-full"
                disabled={pending !== null}
                onClick={() => setConfirmingClear(true)}
              >
                Effacer la copie Cloud…
              </Button>
            )}
          </PanelSection>
        )}

        <PanelSection title="Plan actuel">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{currentPlan}</p>
            <Check size={13} strokeWidth={2} aria-label="Actif" className="text-marker" />
          </div>
          <p className="text-xs leading-4 text-muted-foreground">{planDetail}</p>
          {cloud && (
            <p className="text-xs leading-4 text-muted-foreground">
              Synchronisation : projets, images et thème sur chaque machine.
            </p>
          )}
          {!cloud && (
            <Button variant="default" size="sm" className="w-full" onClick={openPricing}>
              Passer au Cloud
            </Button>
          )}
          {!cloud && durable === false && (
            <p className="text-xs leading-4 text-muted-foreground">
              Vos projets vivent dans ce navigateur, qui n’a pas garanti de les conserver.
              Téléchargez-en une copie depuis le menu du projet, ou choisissez Cloud.
            </p>
          )}
        </PanelSection>

        <PanelSection title="Session">
          {/* Le portail n'apparaît qu'à qui a quelque chose à y voir : chez un
              compte sans achat, il n'ouvre qu'une page vide. */}
          {hasBillingHistory && (
            <Button
              variant="outline"
              className="w-full"
              loading={pending === 'portal'}
              disabled={pending !== null}
              onClick={() => void openPortal()}
            >
              Factures et paiement
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => {
              setShowAccountDialog(false)
              void signOutAndReport()
            }}
          >
            Se déconnecter
          </Button>
        </PanelSection>

        <PanelSection title="Zone dangereuse">
          <Button
            variant="destructive-outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => setConfirmingDelete(true)}
          >
            Supprimer mon compte
          </Button>
        </PanelSection>
      </div>

      <ConfirmAction
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Supprimer votre compte ?"
        description="Le compte, les droits achetés, les projets synchronisés et l’historique PostHog identifié seront effacés définitivement. Les projets de cette machine sont conservés. Certaines pièces Polar peuvent rester conservées pour les obligations comptables."
        confirmLabel="Supprimer mon compte"
        onConfirm={() => void confirmDelete()}
      />
    </DialogShell>
  )
}

function CloudUsagePanel({ usage }: { usage: CloudUsage | 'loading' | 'error' }) {
  if (usage === 'loading') {
    return (
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        Mesure en cours…
      </p>
    )
  }
  if (usage === 'error') {
    return (
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        Utilisation indisponible. Local et les autres actions restent disponibles.
      </p>
    )
  }
  return (
    <div className="mt-2 flex flex-col gap-2" aria-live="polite">
      <CloudUsageLine label="Projets" value={usage.projects} />
      <CloudUsageLine label="Images" value={usage.assets} />
    </div>
  )
}

function CloudUsageLine({ label, value }: { label: string; value: CloudUsageRow }) {
  const states = [
    cloudUsageState(value.count, value.limitCount),
    cloudUsageState(value.bytes, value.limitBytes),
  ]
  const state: CloudUsageState = states.includes('reached')
    ? 'reached'
    : states.includes('near')
      ? 'near'
      : 'normal'
  return (
    <p className={`flex items-center justify-between gap-3 text-xs ${usageClass(state)}`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">
        {value.count}/{value.limitCount} · {formatCloudBytes(value.bytes)}/
        {formatCloudBytes(value.limitBytes)}
      </span>
    </p>
  )
}

function usageClass(state: CloudUsageState): string {
  if (state === 'reached') return 'text-destructive'
  if (state === 'near') return 'text-warning'
  return 'text-muted-foreground'
}

function dateLabel(prefix: string, iso: string | null | undefined): string | null {
  const date = formatGrantDate(iso ?? null)
  return date ? `${prefix} ${date}` : null
}
