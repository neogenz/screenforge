import { CLOUD_OFFER } from '@screenforge/project-format'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireUser } from './authz'
import { consume } from './limits'
import { deleteIfUnreferenced } from './storageReferences'

const usageRow = v.object({
  count: v.number(),
  bytes: v.number(),
  limitCount: v.number(),
  limitBytes: v.number(),
})

export const myUsage = query({
  args: {},
  returns: v.object({ projects: usageRow, assets: usageRow }),
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const [projects, assets] = await Promise.all([
      ctx.db
        .query('projects')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(CLOUD_OFFER.limits.projects + 1),
      ctx.db
        .query('assets')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(CLOUD_OFFER.limits.assets + 1),
    ])
    return {
      projects: {
        count: projects.length,
        bytes: projects.reduce((total, row) => total + row.byteLength, 0),
        limitCount: CLOUD_OFFER.limits.projects,
        limitBytes: CLOUD_OFFER.limits.projectBytes,
      },
      assets: {
        count: assets.length,
        bytes: assets.reduce((total, row) => total + row.byteLength, 0),
        limitCount: CLOUD_OFFER.limits.assets,
        limitBytes: CLOUD_OFFER.limits.assetBytes,
      },
    }
  },
})

const BATCH = 200
export type ClearCloudDataOutcome = 'cleared' | 'incomplete'

async function jobFor(ctx: MutationCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('cloudDataClearJobs')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
}

export async function cloudDataGeneration(ctx: MutationCtx, userId: Id<'users'>): Promise<number> {
  const state = await ctx.db
    .query('cloudDataStates')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  return state?.generation ?? 0
}

async function advanceCloudDataGeneration(ctx: MutationCtx, userId: Id<'users'>): Promise<void> {
  const state = await ctx.db
    .query('cloudDataStates')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  if (state) await ctx.db.patch(state._id, { generation: state.generation + 1 })
  else await ctx.db.insert('cloudDataStates', { userId, generation: 1 })
}

/** One bounded, retryable pass. The job row blocks Cloud writes between passes. */
export const clearMyCloudData = mutation({
  args: {},
  returns: v.union(v.literal('cleared'), v.literal('incomplete')),
  handler: async (ctx): Promise<ClearCloudDataOutcome> => {
    const userId = await requireUser(ctx)
    let job = await jobFor(ctx, userId)
    if (!job) {
      await consume(ctx, 'cloudDataClear', userId)
      await advanceCloudDataGeneration(ctx, userId)
      const id = await ctx.db.insert('cloudDataClearJobs', { userId })
      job = await ctx.db.get(id)
    }

    const assets = await ctx.db
      .query('assets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const asset of assets) {
      await deleteIfUnreferenced(ctx, asset.storageId, { table: 'assets', id: asset._id })
      await ctx.db.delete(asset._id)
    }
    if (assets.length === BATCH) return 'incomplete'

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(BATCH)
    for (const project of projects) {
      await deleteIfUnreferenced(ctx, project.blobId, { table: 'projects', id: project._id })
      await ctx.db.delete(project._id)
    }
    if (projects.length === BATCH) return 'incomplete'

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (settings) await ctx.db.delete(settings._id)
    if (job) await ctx.db.delete(job._id)
    return 'cleared'
  },
})
