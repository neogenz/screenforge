import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { createCheckout, createPortalSession } from '@/lib/api'
import type { Entitlements } from '@/lib/entitlements'
import { formatGrantDate, PLANS, type Plan, type SellableProduct } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'

export function PricingDialog() {
  const showPricingDialog = useUIStore((s) => s.showPricingDialog)

  if (!showPricingDialog) return null
  return <PricingDialogContent />
}

function PricingDialogContent() {
  const setShowPricingDialog = useUIStore((s) => s.setShowPricingDialog)
  const entitlements = useAuthStore((s) => s.entitlements)
  const signedIn = useAuthStore((s) => s.status === 'signed-in')
  /** Quel bouton attend, pas un booléen global : trois en partagent la boîte. */
  const [pending, setPending] = useState<SellableProduct | 'portal' | null>(null)

  const licence = entitlements?.licence ?? false
  const cloud = entitlements?.cloud ?? false

  async function buy(product: SellableProduct) {
    setPending(product)
    const outcome = await createCheckout(product)
    /* Le succès ne repasse pas ici : la page part chez Polar. Seul l'échec
       revient, et il faut alors rendre le bouton. */
    if (outcome.ok) {
      window.location.assign(outcome.url)
      return
    }
    setPending(null)
    toast(CHECKOUT_ERRORS[outcome.reason], 'error')
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

  return (
    <Dialog
      open
      onClose={() => setShowPricingDialog(false)}
      title="Offres ScreenForge"
      size="lg"
      footer={
        /* Le portail n'apparaît qu'à qui a quelque chose à y voir : chez un
           compte sans achat, il n'ouvre qu'une page vide. */
        licence ? (
          <Button
            variant="ghost"
            size="sm"
            loading={pending === 'portal'}
            disabled={pending !== null}
            onClick={() => void openPortal()}
          >
            Factures et abonnement
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              owned={(plan.id === 'licence' && licence) || (plan.id === 'cloud' && cloud)}
              ownedNote={ownedNote(plan.id, entitlements)}
              /* La règle « le Cloud exige la Licence », dite avant le clic.
                 Le backend la redit en 403 : celui-ci est lisible, celui-là est
                 opposable. */
              lockedReason={plan.id === 'cloud' && !licence ? 'Nécessite la Licence' : undefined}
              pending={pending === plan.id}
              disabled={pending !== null || !signedIn}
              onBuy={() => void buy(plan.id as SellableProduct)}
            />
          ))}
        </div>

        {!signedIn && (
          <p className="field-label">
            Connectez-vous pour acheter : la Licence est rattachée à un compte, pas à ce navigateur.
          </p>
        )}
      </div>
    </Dialog>
  )
}

const CHECKOUT_ERRORS: Record<
  'licence-required' | 'unauthenticated' | 'rate-limited' | 'failed',
  string
> = {
  'licence-required': 'Le Cloud est un complément à la Licence : achetez-la d’abord.',
  unauthenticated: 'Session expirée. Reconnectez-vous pour acheter.',
  'rate-limited': 'Trop de tentatives d’achat. Réessayez dans un instant.',
  failed: 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.',
}

/**
 * Ce qu'un palier détenu dit de lui-même : une date, pas un simple « oui ».
 *
 * La distinction entre les deux droits est là et nulle part ailleurs : une
 * licence porte le jour où elle a été acquise et rien après, un abonnement
 * porte le jour où il s'arrête. C'est aussi ce qu'un utilisateur vient
 * vérifier après une résiliation.
 */
function ownedNote(id: Plan['id'], entitlements: Entitlements | null): string | undefined {
  if (id === 'licence' && entitlements?.licence) {
    const date = formatGrantDate(entitlements.licenceGrantedAt)
    return date ? `Acquise le ${date}` : 'Acquise'
  }
  if (id === 'cloud' && entitlements?.cloud) {
    const date = formatGrantDate(entitlements.cloudPeriodEnd)
    return date ? `Actif jusqu’au ${date}` : 'Actif'
  }
  return undefined
}

interface PlanCardProps {
  plan: Plan
  owned: boolean
  ownedNote?: string
  lockedReason?: string
  pending: boolean
  disabled: boolean
  onBuy: () => void
}

/**
 * Une carte par palier, et le Gratuit n'a pas de bouton : il n'y a rien à
 * acheter et rien à activer, c'est l'état où l'on se trouve déjà.
 */
function PlanCard({
  plan,
  owned,
  ownedNote,
  lockedReason,
  pending,
  disabled,
  onBuy,
}: PlanCardProps) {
  const locked = Boolean(lockedReason)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        /* Marker et non la recette « sélectionné » (`border-foreground
           bg-muted`) : la carte « owned » n'est pas un choix à refaire, c'est
           « vous êtes ici » — l'état que le citron réserve. Seule carte de
           dialogue à le porter, à dessein. */
        owned ? 'border-marker-line bg-marker-soft' : 'border-border bg-card',
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
        {owned ? (
          <span className="rounded-xs bg-marker px-1.5 py-0.5 text-2xs font-semibold text-marker-ink">
            Actif
          </span>
        ) : plan.badge ? (
          <span className="text-2xs text-muted-foreground">{plan.badge}</span>
        ) : null}
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="text-base font-semibold tabular-nums">{plan.price}</span>
        {plan.period && <span className="text-2xs text-muted-foreground">{plan.period}</span>}
      </p>

      <p className="text-2xs leading-4 text-muted-foreground">{plan.tagline}</p>

      {/* Une coche par point, et l'icône de stockage nulle part : posée sur les
          trois lignes elle mettait un disque dur à côté de « 3 exports par
          projet », qui n'est pas une histoire de stockage. La carte dit déjà où
          vivent les projets par sa dernière puce. */}
      <ul className="flex flex-col gap-1.5">
        {plan.points.map((point) => (
          <li key={point} className="flex items-start gap-1.5 text-2xs leading-4">
            <Check
              aria-hidden
              size={12}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            {point}
          </li>
        ))}
      </ul>

      {plan.id !== 'free' && (
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {/* Rien à presser sur un palier déjà détenu : le bouton désactivé qui
              tenait cette place répétait le badge « Actif » et rendait, grisé
              sur le fond citron, le contrôle le plus pâle de la boîte. Le
              gabarit est conservé — `min-h-8`, la hauteur du bouton d'en
              face — pour que les deux cartes payantes gardent leur ligne. */}
          {owned ? (
            <p className="flex min-h-8 items-center justify-center gap-1.5 text-center text-2xs leading-4 font-medium text-foreground">
              <Check size={12} strokeWidth={2} aria-hidden className="shrink-0" />
              {ownedNote ?? 'Actif'}
            </p>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              loading={pending}
              disabled={disabled || locked}
              /* Le motif du verrouillage est écrit sous le bouton et pas
                 seulement dans un `title` : un bouton grisé sans raison lisible
                 est une impasse. */
              aria-describedby={locked ? `${plan.id}-locked` : undefined}
              onClick={onBuy}
            >
              {locked && <Lock size={13} strokeWidth={2} aria-hidden />}
              {/* Les mêmes mots verrouillé ou non : ce qui change est l'état du
                  bouton, pas ce qu'il achète. */}
              Acheter {plan.name}
            </Button>
          )}
          {/* Ligne réservée sur les deux cartes payantes : seule celle du Cloud
              écrit dedans, et sans la réserve son bouton montait de 16px — les
              deux seuls boutons comparables de la boîte ne partageaient plus de
              ligne de base. */}
          <p
            id={`${plan.id}-locked`}
            className="min-h-4 text-center text-2xs leading-4 text-muted-foreground"
          >
            {lockedReason ?? ' '}
          </p>
        </div>
      )}
    </div>
  )
}
