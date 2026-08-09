import { Hono } from 'hono'
import { prepareAccountDeletion, requestAccountDeletion } from '../account-deletion.ts'
import { requireAuth, type AuthVariables } from '../middleware/auth.ts'

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

    if (!(await prepareAccountDeletion(userId))) {
      return c.json({ error: 'QUEUE_FAILED' as const }, 502)
    }

    const outcome = await requestAccountDeletion(userId)
    if (outcome === 'failed') return c.json({ error: 'DELETE_FAILED' as const }, 502)
    if (outcome === 'unknown') {
      return c.json(
        { deleted: false as const, cleanupPending: true as const, outcome: 'unknown' as const },
        202,
      )
    }
    return outcome === 'deleted'
      ? c.json({ deleted: true as const, cleanupPending: false as const })
      : c.json({ deleted: true as const, cleanupPending: true as const }, 202)
  },
)
