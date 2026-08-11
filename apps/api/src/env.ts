import { z } from 'zod'

/**
 * Les variables du service, validées une fois, au démarrage.
 *
 * Une clé absente doit arrêter le processus au boot, pas produire un 500 à la
 * première demande : entre les deux il y a quelqu'un qui a demandé la
 * suppression de son compte et un nettoyage qui n'aura jamais lieu.
 *
 * Les variables Polar ont quitté ce fichier avec la vente : elles se posent
 * maintenant par `npx convex env set`, et `billing.healthcheck` dit lesquelles
 * manquent — une fonction Convex n'a pas de démarrage où se plaindre.
 *
 * Rien de ce qui est ici n'entre dans `apps/web`. La clé `service_role` court-
 * circuite la RLS ; c'est ce qui permet à ce service d'écrire un droit que son
 * titulaire ne peut pas s'accorder lui-même, et c'est exactement pour ça
 * qu'elle ne doit jamais atteindre un navigateur. La CI le vérifie par grep.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  /** Origines autorisées à appeler l'API, séparées par des virgules. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  cached ??= schema.parse(process.env)
  return cached
}
