import { isCloudActive, type Entitlements } from 'backend/entitlements'
import { fetchRemoteEntitlements } from '@/lib/cloud'

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
      cloud: isCloudActive(parsed.cloudStatus, parsed.cloudPeriodEnd, Date.now()),
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
 * Les droits du compte connecté, lus dans le miroir plutôt que chez Polar.
 *
 * Le miroir existe pour cela : que l'éditeur sache ce qu'il a le droit de faire
 * sans interroger un tiers. Demander l'état du client au vendeur ferait dépendre
 * la sync de la disponibilité d'un second service, pour une
 * donnée que le déploiement tient déjà à jour.
 *
 * La lecture est une query Convex et il n'y a rien à traduire ici :
 * `mirror.myEntitlements` applique `toEntitlements` côté serveur et rend
 * exactement la forme attendue. C'est aussi ce qui la rend lisible par son seul
 * titulaire — la query ne prend pas d'identifiant en argument, donc il n'y a
 * aucun paramètre à falsifier.
 *
 * `null` n'est pas « aucun droit » : c'est « la question ne se pose pas » —
 * pas d'instance configurée, ou pas de session. L'appelant les distingue.
 */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  return await fetchRemoteEntitlements()
}
