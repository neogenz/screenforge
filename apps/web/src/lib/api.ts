import type { AppType, Entitlements } from 'api'
import { getSupabase } from '@/lib/supabase'

/**
 * Le client de l'API de vente, typé depuis `apps/api`.
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
export const billingConfigured = Boolean(baseUrl)

export type { Entitlements }

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

/**
 * Les droits du compte connecté, ou `null` quand il n'y a rien à demander —
 * pas d'API configurée, ou pas de session. `null` n'est pas « aucun droit » :
 * c'est « la question ne se pose pas », et l'appelant les distingue.
 */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  if (!billingConfigured) return null
  const response = await (await api()).me.$get()
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`GET /me: ${response.status}`)
  return response.json()
}

export type CheckoutOutcome =
  | { ok: true; url: string }
  /** Le Cloud demandé sans la Licence — refusé avant tout paiement. */
  | { ok: false; reason: 'licence-required' }
  | { ok: false; reason: 'unauthenticated' }
  | { ok: false; reason: 'failed' }

export async function createCheckout(product: 'licence' | 'cloud'): Promise<CheckoutOutcome> {
  if (!billingConfigured) return { ok: false, reason: 'failed' }
  const response = await (await api()).billing.checkout.$post({ json: { product } })
  if (response.status === 401) return { ok: false, reason: 'unauthenticated' }
  if (response.status === 403) return { ok: false, reason: 'licence-required' }
  if (!response.ok) return { ok: false, reason: 'failed' }
  const { url } = await response.json()
  return { ok: true, url }
}

/** L'URL du portail client Polar — factures, moyen de paiement, résiliation. */
export async function createPortalSession(): Promise<string | null> {
  if (!billingConfigured) return null
  const response = await (await api()).billing.portal.$post()
  if (!response.ok) return null
  const { url } = await response.json()
  return url
}
