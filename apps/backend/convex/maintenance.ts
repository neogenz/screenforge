import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { deleteIfUnreferenced } from './storageReferences'

const BATCH_SIZE = 25

export const sweepOrphanBlobs = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    visited: v.number(),
    deleted: v.number(),
  },
  returns: v.object({ done: v.boolean(), visited: v.number(), deleted: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.system
      .query('_storage')
      .paginate({ cursor: args.cursor, numItems: BATCH_SIZE })
    let deleted = args.deleted
    for (const blob of page.page) {
      if (await deleteIfUnreferenced(ctx, blob._id)) deleted += 1
    }
    const visited = args.visited + page.page.length
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.maintenance.sweepOrphanBlobs, {
        cursor: page.continueCursor,
        visited,
        deleted,
      })
    } else {
      console.info('Storage orphan sweep completed.', { visited, deleted })
    }
    return { done: page.isDone, visited, deleted }
  },
})
