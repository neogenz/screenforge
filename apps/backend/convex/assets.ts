import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, type MutationCtx } from './_generated/server'
import { requireCloud, requireUser } from './authz'
import { consume, MAX_ASSET_BYTES_PER_ACCOUNT, MAX_ASSETS_PER_ACCOUNT } from './limits'
import { MAX_IMAGE_FILE_BYTES, isContentImageType } from './media'
import { deleteIfUnreferenced } from './storageReferences'

export const ASSET_REJECTED = 'ASSET_REJECTED' as const
export const ASSET_SIZE_LIMIT = 'ASSET_SIZE_LIMIT' as const
export const ASSET_COUNT_LIMIT = 'ASSET_COUNT_LIMIT' as const
export const ASSET_STORAGE_LIMIT = 'ASSET_STORAGE_LIMIT' as const

function reject(code: string = ASSET_REJECTED): never {
  throw new ConvexError({ code })
}

export function acceptable(contentType: string, byteLength: number): boolean {
  return isContentImageType(contentType) && byteLength > 0 && byteLength <= MAX_IMAGE_FILE_BYTES
}

async function assetRows(ctx: MutationCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('assets')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(MAX_ASSETS_PER_ACCOUNT + 1)
}

function assertAssetQuota(
  rows: Doc<'assets'>[],
  existing: Doc<'assets'> | null,
  byteLength: number,
): void {
  if (!existing && rows.length >= MAX_ASSETS_PER_ACCOUNT) reject(ASSET_COUNT_LIMIT)
  const used = rows.reduce((total, row) => total + row.byteLength, 0)
  if (used - (existing?.byteLength ?? 0) + byteLength > MAX_ASSET_BYTES_PER_ACCOUNT) {
    reject(ASSET_STORAGE_LIMIT)
  }
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
    if (byteLength !== null && byteLength > MAX_IMAGE_FILE_BYTES) reject(ASSET_SIZE_LIMIT)
    const existing = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    const rows = await assetRows(ctx, userId)
    if (byteLength === null) {
      if (!existing && rows.length >= MAX_ASSETS_PER_ACCOUNT) reject(ASSET_COUNT_LIMIT)
    } else {
      assertAssetQuota(rows, existing, byteLength)
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
    assertAssetQuota(await assetRows(ctx, userId), existing, stored.size)
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

export const removeAsset = mutation({
  args: { assetId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { assetId }) => {
    const userId = await requireUser(ctx)
    const existing = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique()
    if (!existing) return false
    await ctx.db.delete(existing._id)
    await deleteIfUnreferenced(ctx, existing.storageId)
    return true
  },
})
