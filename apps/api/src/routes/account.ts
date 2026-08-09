import { Hono } from 'hono'
import {
  cancelAccountDeletion,
  cleanupAccountDeletion,
  markAccountDeleted,
  prepareAccountDeletion,
} from '../account-deletion.ts'
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
 * Les binaires de Storage ne cascadent pas. Une ligne durable, sans FK vers
 * `auth.users`, est donc écrite avant l'identité : elle ferme immédiatement les
 * uploads via RLS et survit au cascade. La purge reliste le dossier jusqu'à ce
 * qu'il soit vide ; si Storage tombe, le worker du processus reprend la même
 * opération idempotente au démarrage puis chaque minute.
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

    if (!(await prepareAccountDeletion(userId))) {
      return c.json({ error: 'QUEUE_FAILED' as const }, 502)
    }

    const { error } = await client.auth.admin.deleteUser(userId)
    if (error) {
      if (!(await cancelAccountDeletion(userId))) {
        console.error('Could not roll back account deletion queue.', { userId })
      }
      return c.json({ error: 'DELETE_FAILED' as const }, 502)
    }

    await markAccountDeleted(userId)
    const cleaned = await cleanupAccountDeletion(userId)
    return cleaned
      ? c.json({ deleted: true as const, cleanupPending: false as const })
      : c.json({ deleted: true as const, cleanupPending: true as const }, 202)
  },
)
