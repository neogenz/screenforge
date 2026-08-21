import { v } from 'convex/values'
import { env, internalQuery } from './_generated/server'
import { evaluatePreflight } from './preflight_evaluation'

export { evaluatePreflight } from './preflight_evaluation'
export type { PreflightTarget } from './preflight_evaluation'

export const check = internalQuery({
  args: { target: v.union(v.literal('preproduction'), v.literal('production')) },
  returns: v.object({
    ready: v.boolean(),
    missing: v.array(v.string()),
    inconsistent: v.array(v.string()),
  }),
  handler: (_ctx, { target }) => evaluatePreflight(target, env),
})
