import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../middleware/auth.ts'
import { serviceClient } from '../supabase.ts'

/**
 * La suppression du compte, et de tout ce qui y pend.
 *
 * Une seule instruction suffit : `auth.users` est référencée en
 * `on delete cascade` par `projects` et `entitlements`, donc la ligne
 * d'identité emporte les droits et les projets avec elle. Supprimer table par
 * table depuis ici recréerait la même chaîne en TypeScript, avec le risque
 * qu'une table ajoutée demain n'y soit jamais inscrite.
 *
 * Les binaires de Storage, eux, ne cascadent pas : `storage.objects` ne
 * référence pas `auth.users` — c'est le chemin qui porte l'appartenance. Ils
 * sont donc listés avant la suppression de l'identité, puis retirés depuis les
 * chemins capturés. Cet ordre est intentionnel : un échec Auth ne doit jamais
 * laisser un compte vivant dont on aurait déjà détruit les binaires. Si
 * Storage échoue après la disparition de l'identité, la réponse et le journal
 * exposent ce nettoyage en attente au lieu de prétendre que le compte existe
 * encore.
 *
 * Le geste est irréversible et sans confirmation côté serveur : la double
 * confirmation vit dans l'interface, là où l'utilisateur est.
 */
export const account = new Hono<{ Variables: AuthVariables }>().delete(
  '/account',
  requireAuth,
  async (c) => {
    const userId = c.get('user').id
    const client = serviceClient()

    const objects: { name: string }[] = []
    const pageSize = 100
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.storage
        .from('assets')
        .list(userId, { limit: pageSize, offset })
      if (error) return c.json({ error: 'PURGE_FAILED' as const }, 502)
      objects.push(...data)
      if (data.length < pageSize) break
    }
    const { error } = await client.auth.admin.deleteUser(userId)
    if (error) return c.json({ error: 'DELETE_FAILED' as const }, 502)

    if (objects.length > 0) {
      const { error: removeError } = await client.storage
        .from('assets')
        .remove(objects.map((object) => `${userId}/${object.name}`))
      if (removeError) {
        console.error('Account deleted with Storage cleanup pending.', {
          userId,
          objectCount: objects.length,
          error: removeError,
        })
        return c.json({ deleted: true as const, cleanupPending: true as const }, 202)
      }
    }

    return c.json({ deleted: true as const, cleanupPending: false as const })
  },
)
