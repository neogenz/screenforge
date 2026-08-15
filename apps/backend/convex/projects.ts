import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireCloud, requireUser } from './authz'
import { consume } from './limits'
import { MAX_PROJECT_BLOB_BYTES } from './media'
import { deleteIfUnreferenced } from './storageReferences'

export const PUSH_OUTCOMES = ['accepted', 'stale', 'too-large'] as const
export type PushOutcome = (typeof PUSH_OUTCOMES)[number]
export const PROJECT_REJECTED = 'PROJECT_REJECTED' as const

function validIntent(projectId: string, name: string, updatedAt: number): boolean {
  return projectId.length > 0 && name.length > 0 && Number.isFinite(updatedAt)
}

/** Authorize and rate-limit before an HTTP action reads request bytes. */
export const authorizeProjectUpload = internalMutation({
  args: {
    projectId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
    contentType: v.string(),
    byteLength: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, name, updatedAt, contentType, byteLength }) => {
    const userId = await requireCloud(ctx)
    if (
      !validIntent(projectId, name, updatedAt) ||
      contentType !== 'application/json' ||
      (byteLength !== null && byteLength <= 0)
    ) {
      throw new ConvexError({ code: PROJECT_REJECTED })
    }
    await consume(ctx, 'projectPush', userId)
    return null
  },
})

/** Commit bytes created by the authenticated HTTP action; never by the client. */
export const commitProjectUpload = internalMutation({
  args: {
    projectId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
    blobId: v.id('_storage'),
  },
  returns: v.union(...PUSH_OUTCOMES.map((outcome) => v.literal(outcome))),
  handler: async (ctx, { projectId, name, updatedAt, blobId }): Promise<PushOutcome> => {
    const userId = await requireCloud(ctx)
    const blob = await ctx.db.system.get(blobId)
    if (!blob || blob.size <= 0 || blob.size > MAX_PROJECT_BLOB_BYTES) return 'too-large'

    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()

    if (existing && existing.updatedAt >= updatedAt) return 'stale'

    if (existing) {
      const replaced = existing.blobId
      await ctx.db.patch(existing._id, { name, updatedAt, blobId })
      await deleteIfUnreferenced(ctx, replaced)
    } else {
      await ctx.db.insert('projects', { userId, projectId, name, updatedAt, blobId })
    }
    return 'accepted'
  },
})

const PROJECT_CATALOGUE_LIMIT = 1000

export const listProjects = query({
  args: {},
  returns: v.array(v.object({ projectId: v.string(), name: v.string(), updatedAt: v.number() })),
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const rows = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(PROJECT_CATALOGUE_LIMIT)
    return rows.map(({ projectId, name, updatedAt }) => ({ projectId, name, updatedAt }))
  },
})

export const removeProject = mutation({
  args: { projectId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { projectId }) => {
    const userId = await requireUser(ctx)
    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()
    if (!existing) return false
    await ctx.db.delete(existing._id)
    await deleteIfUnreferenced(ctx, existing.blobId)
    return true
  },
})
