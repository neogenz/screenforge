import type { AppType } from 'api'
import { connect } from '@/lib/cloud'
import { commercialLaunch } from '@/lib/commercial-launch'
import { errorCode } from '@/lib/convex'
import { getSupabase } from '@/lib/supabase'

/**
 * Les gestes de vente : ouvrir un checkout, ouvrir le portail client.
 *
 * Les deux sont désormais des actions Convex, appelées sur le client que
 * `lib/cloud.ts` tient déjà. Elles ne pouvaient pas se faire depuis le
 * navigateur parce qu'elles demandent le jeton Polar ; c'est toujours vrai, et
 * ce qui a changé est seulement où ce jeton est posé. Les droits, eux, se
 * lisent dans le miroir — voir `lib/entitlements.ts`.
 *
 * Ce qui reste de `apps/api` ici, c'est la suppression de compte, et pour une
 * phase encore : elle porte un nettoyage du stockage qui n'a pas encore migré.
 * `AppType` traverse la frontière en `import type`, donc rien du service n'entre
 * dans le paquet du navigateur, seule sa forme.
 *
 * `hono/client` reste chargé à la demande : l'éditeur doit rester dessinable
 * sans rien savoir de la vente, et son chemin critique est mesuré.
 */
const baseUrl = import.meta.env.VITE_API_URL

/**
 * Constante de compilation : dans une build sans API, tout ce que ce booléen
 * garde disparaît à l'élagage. Sans elle, l'éditeur afficherait des tarifs
 * qu'aucun checkout ne peut honorer.
 */
export const billingConfigured = commercialLaunch

/**
 * Le jeton de la session courante, relu à chaque appel.
 *
 * Pas capturé une fois : `access_token` expire et le SDK le renouvelle en
 * arrière-plan. Un en-tête figé au montage rendrait des 401 au bout d'une heure.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const pending = getSupabase()
  if (!pending) return {}
  const { data } = await (await pending).auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function buildClient() {
  const { hc } = await import('hono/client')
  return hc<AppType>(baseUrl ?? '', { headers: authHeaders })
}

type ApiClient = Awaited<ReturnType<typeof buildClient>>

let client: Promise<ApiClient> | null = null

function api(): Promise<ApiClient> {
  client ??= buildClient()
  return client
}

export type CheckoutOutcome =
  | { ok: true; url: string }
  /** Le Cloud demandé sans la Licence — refusé avant tout paiement. */
  | { ok: false; reason: 'licence-required' }
  | { ok: false; reason: 'unauthenticated' }
  /** Trop de checkouts dans l'heure : chacun crée un objet chez Polar. */
  | { ok: false; reason: 'rate-limited' }
  | { ok: false; reason: 'failed' }

/**
 * Les refus arrivent en codes et non en statuts HTTP.
 *
 * C'est la seule chose que le passage à Convex change de ce module : `403` et
 * `401` étaient déjà des refus nommés côté serveur, ils portaient juste un
 * numéro le temps du transport. Un code inconnu vaut `failed` — l'éditeur ne
 * doit pas inventer une phrase pour un refus qu'il ne connaît pas.
 */
const CHECKOUT_REFUSALS: Record<string, CheckoutOutcome> = {
  LICENCE_REQUIRED: { ok: false, reason: 'licence-required' },
  UNAUTHENTICATED: { ok: false, reason: 'unauthenticated' },
  RATE_LIMITED: { ok: false, reason: 'rate-limited' },
}

export async function createCheckout(product: 'licence' | 'cloud'): Promise<CheckoutOutcome> {
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
 * Un résultat distinct garde l'interface honnête aux deux frontières ambiguës :
 * la réponse peut se perdre après la suppression effective, et l'identité peut
 * être supprimée alors que le nettoyage Storage doit être repris côté serveur.
 */
export type DeleteAccountOutcome =
  'deleted' | 'cleanup-pending' | 'deletion-pending' | 'failed' | 'unknown'

export async function deleteAccount(): Promise<DeleteAccountOutcome> {
  if (!billingConfigured) return 'failed'
  try {
    const response = await (await api()).account.$delete()
    const result = await response.json()
    if ('outcome' in result) {
      if (result.outcome === 'deletion-pending') return 'deletion-pending'
      if (result.outcome === 'unknown') return 'unknown'
    }
    if (!response.ok) return 'failed'
    if (!('deleted' in result)) return 'failed'
    if (!result.deleted) return 'unknown'
    return result.cleanupPending ? 'cleanup-pending' : 'deleted'
  } catch {
    /* Une rupture réseau ne prouve ni l'échec ni le succès : le serveur peut
       avoir supprimé l'identité avant que sa réponse ne traverse. */
    return 'unknown'
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
