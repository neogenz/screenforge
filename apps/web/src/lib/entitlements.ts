import type { Entitlements } from 'api'
import { commercialLaunch } from '@/lib/commercial-launch'
import { getSupabase } from '@/lib/supabase'

export type { Entitlements }

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
    const periodEnd = parsed.cloudPeriodEnd ? Date.parse(parsed.cloudPeriodEnd) : null
    return {
      ...parsed,
      cloud:
        parsed.licence &&
        parsed.cloudStatus !== null &&
        (periodEnd === null || periodEnd > Date.now()),
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
 * La règle commerciale, troisième et dernière copie.
 *
 * Les deux autres sont `toEntitlements` dans `apps/api/src/entitlements.ts`
 * (la vue du serveur, qui garde le checkout) et `public.has_cloud()` en SQL
 * (la policy, qui garde les écritures). Les trois doivent répondre pareil :
 * l'éditeur qui afficherait un droit que la base refuse montrerait une erreur
 * de sync à quelqu'un qui n'a rien fait de mal.
 *
 * Une copie unique demanderait soit un aller-retour réseau pour chaque
 * décision d'interface, soit du SQL exécuté dans le navigateur. Elles sont donc
 * trois, nommées ici, et chacune est tenue par ses tests.
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
  const periodEnd = row?.cloud_period_end ? Date.parse(row.cloud_period_end) : null
  return {
    userId,
    licence: row?.licence_granted_at != null,
    licenceGrantedAt: row?.licence_granted_at ?? null,
    /* Une résiliation laisse `cloud_status` renseigné jusqu'à la fin de la
       période : l'utilisateur a payé l'année, il l'a jusqu'au bout. */
    cloud:
      row?.licence_granted_at != null &&
      row.cloud_status != null &&
      (periodEnd === null || periodEnd > now.getTime()),
    cloudStatus: row?.cloud_status ?? null,
    cloudPeriodEnd: row?.cloud_period_end ?? null,
  }
}

/**
 * Ce que chaque palier ouvre, et le décompte du palier gratuit.
 *
 * Une seule traduction des droits achetés vers les droits d'usage, lue partout
 * ailleurs : sans elle, « a la Licence » se retesterait dans le chemin d'export,
 * dans la boîte d'export, dans la barre du haut, et l'un des trois finirait par
 * dire autre chose que les deux autres.
 */
export const FREE_EXPORTS_PER_PROJECT = 3

export interface Rights {
  /** Exporter sans filigrane, et sans limite de nombre. */
  cleanExport: boolean
  /** Le ZIP groupé, un fichier par planche, prêt pour App Store Connect. */
  zip: boolean
  /** La synchronisation des projets — le seul droit qui coûte tous les mois. */
  sync: boolean
}

export function rightsOf(
  entitlements: Entitlements | null,
  billingOpen = commercialLaunch,
): Rights {
  /* Before billing launches, the historical product remains the whole product:
     clean unlimited ZIP exports, but never paid cloud sync. The same compile-
     time flag hides checkout and pricing, so the offer and enforcement switch
     together instead of creating a free tier with no way to upgrade. */
  if (!billingOpen) return { cleanExport: true, zip: true, sync: false }
  const licence = entitlements?.licence ?? false
  return {
    cleanExport: licence,
    zip: licence,
    /* Le Cloud, pas la Licence : `Entitlements.cloud` porte déjà la règle
       « le Cloud exige la Licence » et la fin de période. */
    sync: entitlements?.cloud ?? false,
  }
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
