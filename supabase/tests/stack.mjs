/**
 * Le stack local, et le seul geste que le backend est seul à pouvoir faire.
 *
 * Les trois fichiers de test RLS avaient chacun leur copie de `localStack`, et
 * la quatrième arrivait avec la porte Cloud. Une seule ici, plus le semis de
 * droits : depuis que l'écriture d'un projet exige le droit `cloud`, un test
 * qui vérifie l'isolation doit d'abord acheter — sinon il mesure le refus de la
 * porte commerciale au lieu de celui de la RLS.
 */
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

/**
 * @typedef {{ url: string, anonKey: string, serviceKey: string }} Stack
 * @typedef {import('@supabase/supabase-js').SupabaseClient} Client
 */

/**
 * @returns {Stack | null}
 */
export function localStack() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    }
  }
  try {
    /* `supabase status` échoue vite et fort quand rien ne tourne : c'est le
       signal de saut, et il est plus fiable qu'un ping sur un port qu'un autre
       projet Supabase pourrait très bien occuper. */
    const raw = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const status = JSON.parse(raw)
    return { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY }
  } catch {
    return null
  }
}

/**
 * Un client par identité, chacun avec sa propre session.
 * @param {Stack} stack
 * @returns {Client}
 */
export function anonClient(stack) {
  return createClient(stack.url, stack.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Le client du backend — celui du webhook Polar, et de lui seul.
 *
 * C'est le seul rôle qui écrit `entitlements`, par construction : un droit
 * qu'un compte peut s'accorder n'est pas un droit. Les tests l'utilisent pour
 * poser l'achat, jamais pour assertion — celles-ci passent toutes par la clé
 * `anon`, comme un vrai visiteur.
 *
 * @param {Stack} stack
 * @returns {Client}
 */
export function backendClient(stack) {
  return createClient(stack.url, stack.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * L'achat de la Licence seule : perpétuelle, sans échéance.
 * @param {Client} backend
 * @param {string} userId
 */
export function grantLicence(backend, userId) {
  return backend.from('entitlements').upsert({
    user_id: userId,
    polar_customer_id: `cus_${userId.slice(0, 8)}`,
    licence_granted_at: '2026-03-12T09:00:00Z',
  })
}

/**
 * La Licence plus l'abonnement Cloud en cours — ce que `has_cloud()` exige.
 * @param {Client} backend
 * @param {string} userId
 */
export function grantCloud(backend, userId) {
  return backend.from('entitlements').upsert({
    user_id: userId,
    polar_customer_id: `cus_${userId.slice(0, 8)}`,
    licence_granted_at: '2026-03-12T09:00:00Z',
    cloud_status: 'active',
    cloud_period_end: '2099-01-01T00:00:00Z',
  })
}
