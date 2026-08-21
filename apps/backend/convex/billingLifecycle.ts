import { ConvexError, v } from 'convex/values'
import { DELETION_PENDING } from './authz'
import { internalMutation } from './_generated/server'

/**
 * Reserve the billing lifecycle before calling Polar.
 *
 * This mutation and account-deletion admission serialize on the durable job
 * row: either deletion installs its tombstone first, or checkout installs its
 * fence first. The provider call is never made in the gap between them.
 */
export const beginCheckout = internalMutation({
  args: { userId: v.id('users') },
  returns: v.id('billingCheckoutFences'),
  handler: async (ctx, { userId }) => {
    if ((await ctx.db.get(userId)) === null) {
      throw new ConvexError({ code: DELETION_PENDING })
    }
    const deletion = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (deletion !== null) throw new ConvexError({ code: DELETION_PENDING })
    /* Keep the per-user set bounded during ordinary use. Unknown fences are
       retained because they mean Polar may have created a checkout before an
       action interruption. */
    for await (const fence of ctx.db
      .query('billingCheckoutFences')
      .withIndex('by_user', (q) => q.eq('userId', userId))) {
      if (fence.expiresAt !== null && fence.expiresAt <= Date.now()) {
        await ctx.db.delete(fence._id)
      }
    }
    return await ctx.db.insert('billingCheckoutFences', { userId, expiresAt: null })
  },
})

/** Replace the fail-closed reservation with Polar's authoritative expiry. */
export const completeCheckout = internalMutation({
  args: { fenceId: v.id('billingCheckoutFences'), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { fenceId, expiresAt }) => {
    if (await ctx.db.get(fenceId)) await ctx.db.patch(fenceId, { expiresAt })
    return null
  },
})

/** A provider refusal created no checkout, so its reservation can leave. */
export const abandonCheckout = internalMutation({
  args: { fenceId: v.id('billingCheckoutFences') },
  returns: v.null(),
  handler: async (ctx, { fenceId }) => {
    if (await ctx.db.get(fenceId)) await ctx.db.delete(fenceId)
    return null
  },
})
