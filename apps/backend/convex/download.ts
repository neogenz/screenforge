import { v } from 'convex/values'
import { internalQuery } from './_generated/server'

/**
 * Où sont les octets de celui qui demande — et de personne d'autre.
 *
 * Ces deux requêtes sont internes et prennent l'utilisateur en argument parce
 * que leur seul appelant est une `httpAction`, qui l'a lu dans le jeton. Le
 * paramètre n'est donc jamais fourni par un client : c'est la même règle que
 * partout ailleurs — la propriété vient de la session, jamais de la requête.
 *
 * Elles rendent `null` et non une erreur : la route traduit ce `null` en 404,
 * et c'est délibéré. Un 403 confirmerait que l'objet existe, or l'existence est
 * elle-même privée — ce qui est déposé ici est la capture d'écran d'une app
 * non annoncée, et un identifiant devinable suffirait alors à savoir qu'elle
 * existe.
 */

export const assetStorageId = internalQuery({
  args: { userId: v.id('users'), assetId: v.string() },
  returns: v.union(v.object({ storageId: v.id('_storage'), contentType: v.string() }), v.null()),
  handler: async (ctx, { userId, assetId }) => {
    const row = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    return row ? { storageId: row.storageId, contentType: row.contentType } : null
  },
})

export const projectBlobId = internalQuery({
  args: { userId: v.id('users'), projectId: v.string() },
  returns: v.union(v.id('_storage'), v.null()),
  handler: async (ctx, { userId, projectId }) => {
    const row = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()
    return row?.blobId ?? null
  },
})
