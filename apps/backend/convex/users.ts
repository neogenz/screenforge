import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { query } from './_generated/server'

/**
 * Qui est connecté, ou personne.
 *
 * C'est ce qui remplace `onAuthStateChange` : l'éditeur s'abonne à cette query,
 * et le changement de session lui arrive par le même canal que le reste. Elle
 * ne rend que ce que la chrome affiche — un identifiant et une adresse — parce
 * que tout ce qu'elle rendrait de plus finirait dans le `localStorage` d'un
 * navigateur sans que personne l'ait décidé.
 */
export const me = query({
  args: {},
  returns: v.union(v.object({ id: v.string(), email: v.union(v.string(), v.null()) }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get(userId)
    return { id: userId, email: user?.email ?? null }
  },
})
