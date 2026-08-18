import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { requireUser } from './authz'
import { consume } from './limits'

/**
 * Où sont les octets de celui qui demande — et de personne d'autre.
 *
 * Ces mutations internes relisent elles-mêmes l'utilisateur dans la session,
 * vérifient la propriété, puis consomment le budget d'egress avant de rendre
 * l'identifiant Storage. L'appelant ne peut donc fournir ni propriétaire ni
 * clé de quota.
 *
 * Elles rendent `null` et non une erreur : la route traduit ce `null` en 404,
 * et c'est délibéré. Un 403 confirmerait que l'objet existe, or l'existence est
 * elle-même privée — ce qui est déposé ici est la capture d'écran d'une app
 * non annoncée, et un identifiant devinable suffirait alors à savoir qu'elle
 * existe.
 */

export const assetStorageId = internalMutation({
  args: { assetId: v.string() },
  returns: v.union(v.object({ storageId: v.id('_storage'), contentType: v.string() }), v.null()),
  handler: async (ctx, { assetId }) => {
    const userId = await requireUser(ctx)
    const row = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    if (!row) return null
    await consume(ctx, 'assetDownload', userId)
    return { storageId: row.storageId, contentType: row.contentType }
  },
})

export const projectBlobId = internalMutation({
  args: { projectId: v.string() },
  returns: v.union(v.id('_storage'), v.null()),
  handler: async (ctx, { projectId }) => {
    const userId = await requireUser(ctx)
    const row = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()
    if (!row) return null
    await consume(ctx, 'projectDownload', userId)
    return row.blobId
  },
})
