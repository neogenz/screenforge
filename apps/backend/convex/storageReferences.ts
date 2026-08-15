import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

/** Delete bytes only after their last project or asset reference disappeared. */
export async function deleteIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<boolean> {
  const [projects, assets] = await Promise.all([
    ctx.db
      .query('projects')
      .withIndex('by_blobId', (q) => q.eq('blobId', storageId))
      .take(1),
    ctx.db
      .query('assets')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .take(1),
  ])
  if (projects.length > 0 || assets.length > 0) return false
  if (await ctx.db.system.get(storageId)) await ctx.storage.delete(storageId)
  return true
}
