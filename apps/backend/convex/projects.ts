import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server'
import { requireCloud, requireUser } from './authz'
import { consume, MAX_PROJECT_BYTES_PER_ACCOUNT, MAX_PROJECTS_PER_ACCOUNT } from './limits'
import { MAX_PROJECT_BLOB_BYTES } from './media'
import { deleteIfUnreferenced } from './storageReferences'
import { cloudDataGeneration } from './cloudData'

export const PUSH_OUTCOMES = ['accepted', 'stale', 'too-large', 'invalidated'] as const
export type PushOutcome = (typeof PUSH_OUTCOMES)[number]
export const PROJECT_REJECTED = 'PROJECT_REJECTED' as const
export const PROJECT_SIZE_LIMIT = 'PROJECT_SIZE_LIMIT' as const
export const PROJECT_COUNT_LIMIT = 'PROJECT_COUNT_LIMIT' as const
export const PROJECT_STORAGE_LIMIT = 'PROJECT_STORAGE_LIMIT' as const

function deny(code: string): never {
  throw new ConvexError({ code })
}

function validIntent(projectId: string, name: string, updatedAt: number): boolean {
  return projectId.length > 0 && name.length > 0 && Number.isFinite(updatedAt)
}

async function projectRows(ctx: MutationCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('projects')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(MAX_PROJECTS_PER_ACCOUNT + 1)
}

function assertProjectQuota(
  rows: Doc<'projects'>[],
  existing: Doc<'projects'> | null,
  byteLength: number,
): void {
  if (!existing && rows.length >= MAX_PROJECTS_PER_ACCOUNT) deny(PROJECT_COUNT_LIMIT)
  const used = rows.reduce((total, row) => total + row.byteLength, 0)
  if (used - (existing?.byteLength ?? 0) + byteLength > MAX_PROJECT_BYTES_PER_ACCOUNT) {
    deny(PROJECT_STORAGE_LIMIT)
  }
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
  returns: v.number(),
  handler: async (ctx, { projectId, name, updatedAt, contentType, byteLength }) => {
    const userId = await requireCloud(ctx)
    if (
      !validIntent(projectId, name, updatedAt) ||
      contentType !== 'application/json' ||
      (byteLength !== null && byteLength <= 0)
    ) {
      throw new ConvexError({ code: PROJECT_REJECTED })
    }
    if (byteLength !== null && byteLength > MAX_PROJECT_BLOB_BYTES) deny(PROJECT_SIZE_LIMIT)
    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()
    const rows = await projectRows(ctx, userId)
    if (byteLength === null) {
      if (!existing && rows.length >= MAX_PROJECTS_PER_ACCOUNT) deny(PROJECT_COUNT_LIMIT)
    } else {
      assertProjectQuota(rows, existing, byteLength)
    }
    await consume(ctx, 'projectPush', userId)
    return await cloudDataGeneration(ctx, userId)
  },
})

/** Commit bytes created by the authenticated HTTP action; never by the client. */
export const commitProjectUpload = internalMutation({
  args: {
    projectId: v.string(),
    name: v.string(),
    updatedAt: v.number(),
    blobId: v.id('_storage'),
    generation: v.number(),
  },
  returns: v.union(...PUSH_OUTCOMES.map((outcome) => v.literal(outcome))),
  handler: async (
    ctx,
    { projectId, name, updatedAt, blobId, generation },
  ): Promise<PushOutcome> => {
    const userId = await requireCloud(ctx)
    if ((await cloudDataGeneration(ctx, userId)) !== generation) return 'invalidated'
    const blob = await ctx.db.system.get(blobId)
    if (!blob || blob.size <= 0 || blob.size > MAX_PROJECT_BLOB_BYTES) return 'too-large'

    const existing = await ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique()

    if (existing && existing.updatedAt >= updatedAt) return 'stale'

    assertProjectQuota(await projectRows(ctx, userId), existing, blob.size)

    if (existing) {
      const replaced = existing.blobId
      await ctx.db.patch(existing._id, { name, updatedAt, blobId, byteLength: blob.size })
      await deleteIfUnreferenced(ctx, replaced)
    } else {
      await ctx.db.insert('projects', {
        userId,
        projectId,
        name,
        updatedAt,
        blobId,
        byteLength: blob.size,
      })
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
