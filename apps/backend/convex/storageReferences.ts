import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

type ExcludedReference =
  { table: 'projects'; id: Id<'projects'> } | { table: 'assets'; id: Id<'assets'> }

/** Delete bytes only after their last project or asset reference disappeared. */
export async function deleteIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  excluded?: ExcludedReference,
): Promise<boolean> {
  const [projects, assets] = await Promise.all([
    ctx.db
      .query('projects')
      .withIndex('by_blobId', (q) => q.eq('blobId', storageId))
      .take(excluded?.table === 'projects' ? 2 : 1),
    ctx.db
      .query('assets')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .take(excluded?.table === 'assets' ? 2 : 1),
  ])
  const referenced =
    projects.some((row) => excluded?.table !== 'projects' || row._id !== excluded.id) ||
    assets.some((row) => excluded?.table !== 'assets' || row._id !== excluded.id)
  if (referenced) return false
  if (await ctx.db.system.get(storageId)) await ctx.storage.delete(storageId)
  return true
}
