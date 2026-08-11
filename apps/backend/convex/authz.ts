import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { toEntitlements, type Entitlements, type EntitlementsRow } from './entitlements'

/**
 * Le mur.
 *
 * La migration `cloud_gate.sql` justifiait la RLS ainsi : « Ce verrou ne peut
 * pas vivre dans l'API : la sync va du navigateur à PostgREST et à Storage en
 * direct, sans jamais traverser `apps/api`. Un middleware Hono garderait une
 * porte à côté du mur. La RLS est le mur. »
 *
 * Le raisonnement était juste et sa prémisse a disparu. Convex n'expose pas de
 * table : il n'y a ni PostgREST, ni URL de collection, ni clé anonyme qui ouvre
 * une lecture. Le client ne peut appeler que des fonctions écrites ici. Il n'y a
 * donc plus de porte à côté du mur — **la fonction est le mur**, et ce fichier
 * est l'unique endroit qui décide qui a le droit d'écrire.
 *
 * Trois helpers, et rien d'autre. Une quatrième porte d'entrée serait une
 * quatrième chose à relire le jour où la règle change.
 */

/** Les codes que le client reconnaît ; le texte affiché appartient à l'éditeur. */
export const UNAUTHENTICATED = 'UNAUTHENTICATED' as const
export const CLOUD_REQUIRED = 'CLOUD_REQUIRED' as const
export const DELETION_PENDING = 'DELETION_PENDING' as const

export type AuthzError = {
  code: typeof UNAUTHENTICATED | typeof CLOUD_REQUIRED | typeof DELETION_PENDING
}

function deny(code: AuthzError['code']): never {
  throw new ConvexError<AuthzError>({ code })
}

/** Il y a quelqu'un, ou il n'y a personne. */
export async function requireUser(ctx: QueryCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) deny(UNAUTHENTICATED)
  return userId
}

/** La forme que `toEntitlements` consomme, depuis celle que la base stocke. */
function rowOf(doc: Doc<'entitlements'>): EntitlementsRow {
  return {
    user_id: doc.userId,
    polar_customer_id: doc.polarCustomerId,
    licence_granted_at: doc.licenceGrantedAt,
    cloud_status: doc.cloudStatus,
    cloud_period_end: doc.cloudPeriodEnd,
  }
}

/**
 * Les droits d'un compte. Ne lève jamais : l'absence de ligne est le cas
 * courant — un compte qui n'a rien acheté — et vaut « aucun droit », pas
 * « erreur ».
 */
export async function readEntitlements(
  ctx: QueryCtx,
  userId: Id<'users'>,
  now: Date = new Date(),
): Promise<Entitlements> {
  const doc = await ctx.db
    .query('entitlements')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  return toEntitlements(doc ? rowOf(doc) : null, userId, now)
}

/**
 * Une suppression de compte en cours ferme les écritures.
 *
 * La table n'existe qu'en phase 5. La condition est déclarée ici quand même,
 * parce que l'ajouter après coup obligerait à relire chaque mutation écrite
 * entre-temps pour vérifier qu'elle la porte — alors que la poser maintenant
 * coûte cette fonction, qui rend `false` tant qu'il n'y a rien à lire.
 */
async function deletionPending(): Promise<boolean> {
  return false
}

/**
 * Le droit d'écrire dans le nuage : trois conditions que la RLS portait en
 * trois endroits (`has_cloud()`, `account_deletion_pending()`, et le filtre de
 * propriété — ce dernier étant désormais structurel, puisque toute écriture
 * part de l'identifiant que cette fonction rend).
 *
 * **Ce qui reste ouvert quand le droit s'éteint** : la lecture et la
 * suppression. C'est la règle d'origine, mot pour mot — « un abonnement qui se
 * termine ne doit emporter aucune donnée ». Fermer la lecture transformerait
 * une fin de période en perte apparente, et fermer la suppression retiendrait
 * en otage des fichiers qu'on ne synchronise plus.
 */
export async function requireCloud(ctx: QueryCtx, now: Date = new Date()): Promise<Id<'users'>> {
  const userId = await requireUser(ctx)
  if (await deletionPending()) deny(DELETION_PENDING)
  const entitlements = await readEntitlements(ctx, userId, now)
  if (!entitlements.cloud) deny(CLOUD_REQUIRED)
  return userId
}
