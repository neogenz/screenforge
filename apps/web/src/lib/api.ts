import type { AppType } from 'api'
import { commercialLaunch } from '@/lib/commercial-launch'
import { getSupabase } from '@/lib/supabase'

/**
 * Le client de l'API de vente, typé depuis `apps/api`.
 *
 * Uniquement ce qui ne peut pas se faire sans secret : ouvrir un checkout et
 * ouvrir le portail client. Les droits, eux, se lisent dans le miroir — voir
 * `lib/entitlements.ts`.
 *
 * `AppType` traverse la frontière en `import type` : rien du backend n'entre
 * dans le paquet du navigateur, seule sa forme. Une route retirée ou un champ
 * renommé casse ici, à la compilation, plutôt qu'en production sur un `404`.
 *
 * `hono/client` est chargé à la demande, pour la même raison que le client
 * Supabase l'est : l'éditeur doit rester dessinable sans rien savoir de la
 * vente, et son chemin critique est mesuré.
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
  | { ok: false; reason: 'failed' }

export async function createCheckout(product: 'licence' | 'cloud'): Promise<CheckoutOutcome> {
  if (!billingConfigured) return { ok: false, reason: 'failed' }
  try {
    const response = await (await api()).billing.checkout.$post({ json: { product } })
    if (response.status === 401) return { ok: false, reason: 'unauthenticated' }
    if (response.status === 403) return { ok: false, reason: 'licence-required' }
    if (!response.ok) return { ok: false, reason: 'failed' }
    const { url } = await response.json()
    return { ok: true, url }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/**
 * Supprime le compte et purge ce qu'il a déposé.
 *
 * Un résultat distinct garde l'interface honnête aux deux frontières ambiguës :
 * la réponse peut se perdre après la suppression effective, et l'identité peut
 * être supprimée alors que le nettoyage Storage doit être repris côté serveur.
 */
export type DeleteAccountOutcome = 'deleted' | 'cleanup-pending' | 'failed' | 'unknown'

export async function deleteAccount(): Promise<DeleteAccountOutcome> {
  if (!billingConfigured) return 'failed'
  try {
    const response = await (await api()).account.$delete()
    if (!response.ok) return 'failed'
    const result = await response.json()
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
  if (!billingConfigured) return null
  try {
    const response = await (await api()).billing.portal.$post()
    if (!response.ok) return null
    const { url } = await response.json()
    return url
  } catch {
    return null
  }
}
