import { connect } from '@/lib/cloud'
import { cloudConfigured, errorCode } from '@/lib/convex'

/**
 * Les trois gestes qui engagent le compte : acheter, gérer son abonnement,
 * s'effacer.
 *
 * Trois appels sur le client Convex que `lib/cloud.ts` tient déjà, sur le même
 * déploiement et avec le même jeton : pas de second transport à configurer, pas
 * d'en-tête `Authorization` à reconstruire, pas de statut HTTP à relire.
 *
 * Les deux premiers s'exécutent là-haut et non ici parce qu'ils demandent le
 * jeton Polar, qui n'a rien à faire dans un navigateur. Les droits, eux, se
 * lisent dans le miroir — voir `lib/entitlements.ts`.
 */

/**
 * Constante de compilation : dans une build d'avant-lancement, tout ce que ce
 * booléen garde disparaît à l'élagage. Sans elle, l'éditeur afficherait des
 * tarifs qu'aucun checkout ne peut honorer.
 */
export const billingConfigured = cloudConfigured

export type CheckoutOutcome =
  | { ok: true; url: string }
  | { ok: false; reason: 'unauthenticated' }
  /** Trop de checkouts dans l'heure : chacun crée un objet chez Polar. */
  | { ok: false; reason: 'rate-limited' }
  | { ok: false; reason: 'failed' }

/**
 * Les refus arrivent en codes et non en statuts HTTP.
 *
 * `403` et `401` étaient déjà des refus nommés côté serveur, ils portaient juste
 * un numéro le temps du transport. Un code inconnu vaut `failed` — l'éditeur ne
 * doit pas inventer une phrase pour un refus qu'il ne connaît pas.
 */
const CHECKOUT_REFUSALS: Record<string, CheckoutOutcome> = {
  UNAUTHENTICATED: { ok: false, reason: 'unauthenticated' },
  RATE_LIMITED: { ok: false, reason: 'rate-limited' },
}

export async function createCheckout(product: 'cloud'): Promise<CheckoutOutcome> {
  const connected = connect()
  if (!billingConfigured || !connected) return { ok: false, reason: 'failed' }
  try {
    const { client, api } = await connected
    const { url } = await client.action(api.polar.createCheckout, { product })
    return { ok: true, url }
  } catch (error) {
    return CHECKOUT_REFUSALS[errorCode(error) ?? ''] ?? { ok: false, reason: 'failed' }
  }
}

/**
 * Supprime le compte et purge ce qu'il a déposé.
 *
 * Les issues voyagent sans être réinterprétées par le transport :
 * `deletion-pending` et `cleanup-pending` disent qu'un
 * travail borné continue côté déploiement, `unknown` dit que la réponse peut
 * s'être perdue **après** la suppression effective. Cette dernière n'est plus
 * une ambiguïté du serveur — il supprime l'identité dans la même transaction que
 * le reste — mais une ambiguïté du trajet, et elle survit telle quelle.
 */
export type DeleteAccountOutcome =
  'deleted' | 'cleanup-pending' | 'deletion-pending' | 'billing-active' | 'failed' | 'unknown'

export async function deleteAccount(): Promise<DeleteAccountOutcome> {
  const connected = connect()
  /* Rien à supprimer là-haut sans déploiement : le compte n'existe pas. */
  if (!connected) return 'failed'
  try {
    const { client, api } = await connected
    return await client.mutation(api.accountDeletion.requestAccountDeletion, {})
  } catch (error) {
    /* Un refus nommé est un échec propre : rien n'a commencé, le compte reste
       actif, et l'éditeur peut le dire. Tout le reste — rupture réseau, WebSocket
       fermée — ne prouve ni l'échec ni le succès. */
    return errorCode(error) === null ? 'unknown' : 'failed'
  }
}

/** L'URL du portail client Polar — factures, moyen de paiement, résiliation. */
export async function createPortalSession(): Promise<string | null> {
  const connected = connect()
  if (!billingConfigured || !connected) return null
  try {
    const { client, api } = await connected
    const { url } = await client.action(api.polar.createPortalSession, {})
    return url
  } catch {
    return null
  }
}
