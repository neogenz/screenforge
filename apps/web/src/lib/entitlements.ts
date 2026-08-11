import {
  FREE_EXPORTS_PER_PROJECT,
  isCloudActive,
  rightsOf as rightsOfEntitlements,
  toEntitlements,
  type Entitlements,
  type Rights,
} from 'backend/entitlements'
import { commercialLaunch } from '@/lib/commercial-launch'
import { getSupabase } from '@/lib/supabase'

export { FREE_EXPORTS_PER_PROJECT }
export type { Entitlements, Rights }

/**
 * Les droits d'usage, avec le seul argument que le serveur ne peut pas fournir.
 *
 * `commercialLaunch` est un interrupteur de compilation du navigateur : le
 * backend n'en a pas l'équivalent, donc la règle vit là-bas sans lui et c'est
 * ici qu'on la lie. Ce n'est pas une seconde copie — il n'y a rien à décider
 * dans ces deux lignes, seulement une valeur à passer.
 */
export function rightsOf(
  entitlements: Entitlements | null,
  billingOpen = commercialLaunch,
): Rights {
  return rightsOfEntitlements(entitlements, billingOpen)
}

const CACHE_PREFIX = 'screenforge-entitlements:'

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCachedEntitlements(value: unknown, userId: string): value is Entitlements {
  if (!value || typeof value !== 'object') return false
  const cached = value as Partial<Entitlements>
  return (
    cached.userId === userId &&
    typeof cached.licence === 'boolean' &&
    nullableString(cached.licenceGrantedAt) &&
    typeof cached.cloud === 'boolean' &&
    nullableString(cached.cloudStatus) &&
    nullableString(cached.cloudPeriodEnd)
  )
}

/** The last verified rights, isolated by account for offline startup. */
export function readCachedEntitlements(userId: string): Entitlements | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${userId}`) ?? 'null')
    if (!isCachedEntitlements(parsed, userId)) return null
    /* Le `cloud` conservé date de la dernière vérification en ligne : il est
       recalculé à la lecture, avec la même fonction que le serveur, parce
       qu'une période a pu se terminer pendant que le navigateur était fermé. */
    return {
      ...parsed,
      cloud: isCloudActive(parsed.licence, parsed.cloudStatus, parsed.cloudPeriodEnd, Date.now()),
    }
  } catch (error) {
    console.warn('Could not read cached entitlements.', error)
    return null
  }
}

export function cacheEntitlements(entitlements: Entitlements): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${entitlements.userId}`, JSON.stringify(entitlements))
  } catch (error) {
    console.warn('Could not cache entitlements.', error)
  }
}

/**
 * Les droits du compte connecté, lus dans le miroir plutôt que demandés à l'API.
 *
 * La table `entitlements` est lisible par son titulaire — c'est ce que dit sa
 * policy, et c'est ce pour quoi le miroir existe : que l'éditeur sache ce qu'il
 * a le droit de faire sans interroger un tiers. Passer par `GET /me` ferait
 * dépendre le filigrane et la sync de la disponibilité d'un second service,
 * pour une donnée que le premier sert déjà. L'API garde sa route : c'est sa
 * vue à elle, celle qui garde le checkout.
 *
 * `null` n'est pas « aucun droit » : c'est « la question ne se pose pas » —
 * pas d'instance configurée, ou pas de session. L'appelant les distingue.
 */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  const pending = getSupabase()
  if (!pending) return null
  const supabase = await pending
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return null

  /* `maybeSingle` : un compte qui n'a jamais rien acheté n'a pas de ligne, et
     c'est le cas courant, pas une erreur. */
  const { data, error } = await supabase.from('entitlements').select().maybeSingle()
  if (error) throw error
  return projectEntitlements(data, userId, new Date())
}

/**
 * La ligne de PostgREST, traduite par la règle et non à côté d'elle.
 *
 * Cette fonction portait la règle commerciale une troisième fois, à côté de
 * `toEntitlements` dans le service Hono et de `public.has_cloud()` en SQL. Les
 * trois devaient répondre pareil et rien ne l'imposait. Il n'en reste qu'une,
 * dans `backend/entitlements`, et il ne reste ici que l'appel — jusqu'à ce que
 * la phase 6 retire aussi la lecture Supabase qui l'entoure.
 */
export function projectEntitlements(
  row: {
    licence_granted_at: string | null
    cloud_status: string | null
    cloud_period_end: string | null
  } | null,
  userId: string,
  now: Date,
): Entitlements {
  if (!row) return toEntitlements(null, userId, now)
  return toEntitlements({ user_id: userId, polar_customer_id: '', ...row }, userId, now)
}

/**
 * Le compteur d'exports du palier gratuit.
 *
 * Il vit à côté du projet, jamais dedans : un `.screenforge` partagé ou
 * réimporté remettrait sinon le décompte à zéro, et le fichier de projet
 * porterait une donnée qui ne le décrit pas.
 *
 * `localStorage` plutôt qu'IndexedDB, et c'est assumé : l'export tourne
 * entièrement dans le navigateur — c'est la promesse du produit — donc ce
 * compteur se contourne avec la console ouverte quel que soit son support. Le
 * filigrane est une politesse, pas un verrou (voir `phase-5.md`), et une
 * politesse n'a pas besoin d'une base de données à elle. Un stockage
 * indisponible se lit comme « zéro export » : on ne bloque pas quelqu'un pour
 * une panne de navigateur.
 */
const COUNTER_KEY = 'screenforge-exports'

type Counters = Record<string, number>

function readCounters(): Counters {
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Counters) : {}
  } catch (error) {
    console.warn('Could not read the export counter.', error)
    return {}
  }
}

export function exportsUsed(projectId: string): number {
  const value = readCounters()[projectId]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function exportsLeft(projectId: string, rights: Rights): number {
  if (rights.cleanExport) return Infinity
  return Math.max(0, FREE_EXPORTS_PER_PROJECT - exportsUsed(projectId))
}

/** Appelé après un lot réussi seulement : un export en échec ne coûte rien. */
export function recordExport(projectId: string): void {
  try {
    const counters = readCounters()
    counters[projectId] = exportsUsed(projectId) + 1
    localStorage.setItem(COUNTER_KEY, JSON.stringify(counters))
  } catch (error) {
    console.warn('Could not persist the export counter.', error)
  }
}
