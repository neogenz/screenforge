import { getAuthUserId } from '@convex-dev/auth/server'
import type { Auth } from 'convex/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { toEntitlements, type Entitlements, type EntitlementsRow } from './entitlements'

/**
 * Le mur.
 *
 * Convex n'expose aucune table : pas d'URL de collection, pas de clé anonyme
 * qui ouvre une lecture, aucun chemin vers les données à côté des fonctions. Un
 * client ne peut appeler que ce qui est écrit ici. Il n'y a donc pas de porte à
 * garder à côté du mur — **la fonction est le mur**, et ce fichier est l'unique
 * endroit qui décide qui a le droit d'écrire.
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

/**
 * Il y a quelqu'un, ou il n'y a personne.
 *
 * Le `ctx` est réduit à ce que la question demande : une action authentifie de
 * la même façon qu'une query, et n'a pas de `db` à offrir. Exiger `QueryCtx`
 * obligerait le checkout à redemander l'identité autrement — donc à écrire une
 * seconde fois la seule ligne que ce fichier existe pour n'écrire qu'une fois.
 */
export async function requireUser(ctx: { auth: Auth }): Promise<Id<'users'>> {
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
 * La ligne de file est écrite **avant** toute opération irréversible,
 * et son seul rôle jusqu'à la fin du nettoyage est de refuser un envoi de
 * fichier émis avec un jeton encore valide. La lecture est indexée : elle coûte
 * une entrée d'index à chaque écriture, et rien du tout tant que personne ne
 * supprime son compte.
 */
async function deletionPending(ctx: QueryCtx, userId: Id<'users'>): Promise<boolean> {
  const job = await ctx.db
    .query('accountDeletionJobs')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  return job !== null
}

/**
 * Le droit d'écrire dans le nuage : un compte, le droit `cloud`, et aucune
 * suppression en cours — trois conditions en un seul endroit. La propriété des
 * lignes n'en fait pas partie parce qu'elle est structurelle : toute écriture
 * part de l'identifiant que cette fonction rend.
 *
 * **Ce qui reste ouvert quand le droit s'éteint** : la lecture et la
 * suppression. Un abonnement qui se termine ne doit emporter aucune donnée.
 * Fermer la lecture transformerait
 * une fin de période en perte apparente, et fermer la suppression retiendrait
 * en otage des fichiers qu'on ne synchronise plus.
 */
export async function requireCloud(ctx: QueryCtx, now: Date = new Date()): Promise<Id<'users'>> {
  const userId = await requireUser(ctx)
  if (await deletionPending(ctx, userId)) deny(DELETION_PENDING)
  const entitlements = await readEntitlements(ctx, userId, now)
  if (!entitlements.cloud) deny(CLOUD_REQUIRED)
  return userId
}
