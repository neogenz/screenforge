import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireCloud, requireUser } from './authz'

const settingsShape = v.object({
  theme: v.union(v.literal('light'), v.literal('dark')),
  updatedAt: v.number(),
})

export const mySettings = query({
  args: {},
  returns: v.union(settingsShape, v.null()),
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const row = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    return row ? { theme: row.theme, updatedAt: row.updatedAt } : null
  },
})

export const upsertSettings = mutation({
  args: settingsShape.fields,
  returns: v.union(v.literal('accepted'), v.literal('stale')),
  handler: async (ctx, settings): Promise<'accepted' | 'stale'> => {
    const userId = await requireCloud(ctx)
    if (!Number.isFinite(settings.updatedAt) || settings.updatedAt < 0) {
      throw new ConvexError({ code: 'SETTINGS_REJECTED' })
    }

    const existing = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing && existing.updatedAt >= settings.updatedAt) return 'stale'

    if (existing) await ctx.db.patch(existing._id, settings)
    else await ctx.db.insert('userSettings', { userId, ...settings })
    return 'accepted'
  },
})
