import { ConvexError, v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { requireCloud } from './authz'
import { consume } from './limits'
import { MAX_IMAGE_FILE_BYTES, isContentImageType } from './media'
import { deleteIfUnreferenced } from './storageReferences'

export const ASSET_REJECTED = 'ASSET_REJECTED' as const

function reject(): never {
  throw new ConvexError({ code: ASSET_REJECTED })
}

export function acceptable(contentType: string, byteLength: number): boolean {
  return isContentImageType(contentType) && byteLength > 0 && byteLength <= MAX_IMAGE_FILE_BYTES
}

/** Authorize and rate-limit before an HTTP action reads request bytes. */
export const authorizeAssetUpload = internalMutation({
  args: {
    assetId: v.string(),
    contentType: v.string(),
    byteLength: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { assetId, contentType, byteLength }) => {
    const userId = await requireCloud(ctx)
    if (
      assetId.length === 0 ||
      !isContentImageType(contentType) ||
      (byteLength !== null && byteLength <= 0)
    ) {
      reject()
    }
    await consume(ctx, 'assetUpload', userId)
    return null
  },
})

/** Commit bytes created by the authenticated HTTP action; never by the client. */
export const commitAssetUpload = internalMutation({
  args: {
    assetId: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { assetId, storageId, contentType }) => {
    const userId = await requireCloud(ctx)
    const stored = await ctx.db.system.get(storageId)
    if (!stored || !acceptable(contentType, stored.size)) return false

    const existing = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    if (existing) {
      const replaced = existing.storageId
      await ctx.db.patch(existing._id, { storageId, contentType, byteLength: stored.size })
      await deleteIfUnreferenced(ctx, replaced)
    } else {
      await ctx.db.insert('assets', {
        userId,
        assetId,
        storageId,
        contentType,
        byteLength: stored.size,
      })
    }
    return true
  },
})
