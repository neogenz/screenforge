import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { readEntitlements } from './authz'

/**
 * Les écritures et la lecture du miroir de droits.
 *
 * Elles ne sont pas dans `entitlements.ts` et c'est délibéré : ce fichier-là est
 * la règle pure, importée telle quelle par l'éditeur. Y déclarer une fonction
 * Convex y ferait entrer `./_generated/server`, donc `convex/server`, donc le
 * SDK dans le paquet du navigateur — pour une application qui doit rester
 * entièrement locale sans compte.
 */

const entitlementsShape = v.object({
  userId: v.string(),
  licence: v.boolean(),
  licenceGrantedAt: v.union(v.string(), v.null()),
  cloud: v.boolean(),
  cloudStatus: v.union(v.string(), v.null()),
  cloudPeriodEnd: v.union(v.string(), v.null()),
})

/**
 * Les droits du demandeur. `null` veut dire « pas de session », jamais « aucun
 * droit » — l'appelant distingue les deux, et un compte sans achat rend bien un
 * objet, avec tout à `false`.
 */
export const myEntitlements = query({
  args: {},
  returns: v.union(entitlementsShape, v.null()),
  handler: async (ctx) => {
    /* `getAuthUserId` et non `requireUser` : ici l'absence de session est une
       réponse, pas un refus. Une lecture de droits est ce que l'éditeur fait
       avant de savoir s'il y a quelqu'un. */
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    return await readEntitlements(ctx, userId)
  },
})

/**
 * Le miroir n'accepte que ce qui est plus récent que ce qu'il porte.
 *
 * C'est `apply_entitlements_if_newer` en TypeScript, et la comparaison reste
 * atomique sans plpgsql : une mutation Convex est une transaction, donc le
 * `get` puis le `patch` ne peuvent pas s'entrelacer avec un autre webhook. Deux
 * livraisons désordonnées laissent donc la ligne sur la plus récente, quel que
 * soit leur ordre d'arrivée.
 *
 * `internalMutation` et non `mutation` : une fonction interne n'est pas
 * appelable depuis un client. C'est ce qui remplace la clé `service_role`, et
 * c'est un meilleur remplacement — il n'y a aucun secret à ne pas divulguer.
 *
 * Elle rend le même triplet que la version SQL parce que le webhook s'en sert
 * pour décider s'il journalise :
 * - `written` : la ligne a été créée ou mise à jour ;
 * - `ignored` : la livraison était plus ancienne que ce que porte la ligne, ou
 *   ne désigne aucun compte ;
 * - `unchanged` : ni plus récente ni plus ancienne, donc rien à faire.
 */
export const applyEntitlementsIfNewer = internalMutation({
  args: {
    /**
     * `v.string()` et non `v.id('users')` : cette valeur est l'`externalId` que
     * Polar nous renvoie, donc une chaîne venue du dehors. Un validateur d'`Id`
     * la refuserait en levant, et une exception dans le webhook devient une
     * relivraison — indéfiniment, pour un client qui n'a de toute façon aucun
     * compte ici. Elle est donc reconnue plus bas, et une chaîne qui ne désigne
     * personne vaut `ignored`.
     */
    userId: v.string(),
    polarCustomerId: v.string(),
    licenceGrantedAt: v.union(v.string(), v.null()),
    cloudStatus: v.union(v.string(), v.null()),
    cloudPeriodEnd: v.union(v.string(), v.null()),
    sourceUpdatedAt: v.union(v.number(), v.null()),
  },
  returns: v.union(v.literal('written'), v.literal('unchanged'), v.literal('ignored')),
  handler: async (ctx, args) => {
    const { userId: candidate, ...incoming } = args
    /* Reconnue puis relue : `normalizeId` ne juge que la forme, et une ligne de
       droits accrochée à un compte supprimé serait un orphelin qu'aucune
       lecture ne rattraperait. */
    const userId = ctx.db.normalizeId('users', candidate)
    if (userId === null || (await ctx.db.get(userId)) === null) return 'ignored'

    const existing = await ctx.db
      .query('entitlements')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()

    /* L'unicité que la clé primaire Postgres donnait gratuitement est tenue
       ici : une seule branche insère, et elle n'est prise que si la requête
       indexée n'a rien trouvé — dans la même transaction que l'insertion. */
    if (existing === null) {
      await ctx.db.insert('entitlements', { userId, ...incoming })
      return 'written'
    }

    const current = existing.sourceUpdatedAt
    const next = incoming.sourceUpdatedAt
    if (current === null || (next !== null && next > current)) {
      await ctx.db.patch(existing._id, incoming)
      return 'written'
    }
    /* `next === null` face à une ligne datée : ni plus récent ni plus ancien,
       donc `unchanged` — le SQL disait la même chose, par la propagation de
       `null` dans ses deux comparaisons. */
    return next !== null && next < current ? 'ignored' : 'unchanged'
  },
})
