import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import { consume } from './limits'

const CLEANUP_BATCH_SIZE = 100
/** Auth.js expires the OAuth state cookies after 15 minutes; keep one full grace period. */
export const OAUTH_VERIFIER_MAX_AGE_MS = 30 * 60 * 1_000

/**
 * One mutation owns the whole hierarchical reservation. A later refusal rolls
 * back every earlier component write, so an attacker cannot poison a narrower
 * victim bucket with a request that never passed the broader gates.
 */
export const admit = internalMutation({
  args: {
    kind: v.union(v.literal('magic-link'), v.literal('oauth')),
    sourceKey: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.kind === 'magic-link') {
      if (args.email === undefined) throw new Error('Magic-link email is required.')
      await consume(ctx, 'magicLinkSendGlobal')
      await consume(ctx, 'magicLinkSendBySource', args.sourceKey)
      await consume(ctx, 'magicLinkSend', args.email)
    } else {
      await consume(ctx, 'oauthStartGlobal')
      await consume(ctx, 'oauthStartBySource', args.sourceKey)
    }
    return null
  },
})

/** Remove only an unverified email placeholder left with no usable login path. */
async function removeEmptyMagicLinkIdentity(
  ctx: MutationCtx,
  accountId: Id<'authAccounts'>,
): Promise<void> {
  const account = await ctx.db.get(accountId)
  if (!account || account.provider !== 'resend' || account.emailVerified !== undefined) return
  const anotherCode = await ctx.db
    .query('authVerificationCodes')
    .withIndex('accountId', (q) => q.eq('accountId', account._id))
    .first()
  if (anotherCode) return

  const userId = account.userId
  await ctx.db.delete(account._id)
  const [anotherAccount, session] = await Promise.all([
    ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .first(),
    ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first(),
  ])
  if (!anotherAccount && !session) {
    const user = await ctx.db.get(userId)
    if (user && user.emailVerificationTime === undefined) await ctx.db.delete(userId)
  }
}

/**
 * Bounded cleanup for abandoned OAuth starts and expired one-time codes. The
 * oldest rows are handled first and a full page schedules the next small page.
 */
export const sweepStaleState = internalMutation({
  args: {},
  returns: v.object({ verifiers: v.number(), codes: v.number() }),
  handler: async (ctx) => {
    const now = Date.now()
    const [verifiers, codes] = await Promise.all([
      ctx.db
        .query('authVerifiers')
        .filter((q) => q.lt(q.field('_creationTime'), now - OAUTH_VERIFIER_MAX_AGE_MS))
        .order('asc')
        .take(CLEANUP_BATCH_SIZE),
      ctx.db
        .query('authVerificationCodes')
        .withIndex('by_expirationTime', (q) => q.lt('expirationTime', now))
        .take(CLEANUP_BATCH_SIZE),
    ])

    for (const verifier of verifiers) await ctx.db.delete(verifier._id)
    for (const code of codes) {
      await ctx.db.delete(code._id)
      await removeEmptyMagicLinkIdentity(ctx, code.accountId)
    }
    if (verifiers.length === CLEANUP_BATCH_SIZE || codes.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.authAdmission.sweepStaleState, {})
    }
    return { verifiers: verifiers.length, codes: codes.length }
  },
})
