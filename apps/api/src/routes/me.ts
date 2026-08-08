import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../middleware/auth.ts'
import { readEntitlements } from '../mirror.ts'

/**
 * Les droits du porteur du jeton.
 *
 * Une seule route, et elle rend l'état complet plutôt qu'un booléen par
 * question : l'éditeur en a besoin de tout au même moment — filigrane, ZIP,
 * sync — et trois appels donneraient trois instants différents.
 */
export const me = new Hono<{ Variables: AuthVariables }>().get('/me', requireAuth, async (c) =>
  c.json(await readEntitlements(c.get('user').id)),
)
