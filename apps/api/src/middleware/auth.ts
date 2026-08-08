import { createMiddleware } from 'hono/factory'
import { verifyToken, type AuthedUser } from '../supabase.ts'

export interface AuthVariables {
  user: AuthedUser
}

/**
 * Le porteur du jeton, ou 401.
 *
 * Aucune route de ce service ne lit d'identité ailleurs que dans le jeton :
 * pas de `userId` en corps de requête, pas de paramètre de chemin. C'est la
 * seule forme qui rend impossible d'agir au nom d'un autre en changeant un
 * champ.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return c.json({ error: 'UNAUTHENTICATED' as const }, 401)

  const user = await verifyToken(token)
  if (!user) return c.json({ error: 'UNAUTHENTICATED' as const }, 401)

  c.set('user', user)
  await next()
})
