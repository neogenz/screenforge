import { z } from 'zod'

/**
 * Les variables du service, validées une fois, au démarrage.
 *
 * Une clé absente doit arrêter le processus au boot, pas produire un 500 au
 * premier achat : entre les deux il y a un client qui a payé chez Polar et un
 * miroir de droits qui ne s'écrira jamais.
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

  POLAR_ACCESS_TOKEN: z.string().min(1),
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  /** `sandbox` tant que la vente n'est pas ouverte — voir `.env.example`. */
  POLAR_SERVER: z.enum(['sandbox', 'production']).default('sandbox'),

  /** Les deux produits vendus, côté Polar. */
  POLAR_LICENCE_PRODUCT_ID: z.string().min(1),
  POLAR_CLOUD_PRODUCT_ID: z.string().min(1),
  /**
   * Le bénéfice que le produit Licence accorde.
   *
   * Un achat unique n'apparaît pas dans `activeSubscriptions` — il n'a pas de
   * période. Sa trace dans l'état client est le bénéfice qu'il octroie, donc le
   * produit Licence doit en porter au moins un, et c'est son identifiant qui
   * est lu ici. Sans lui, la projection ne pourrait jamais accorder `licence`.
   */
  POLAR_LICENCE_BENEFIT_ID: z.string().min(1),

  /** Où Polar renvoie l'acheteur une fois le paiement accepté. */
  CHECKOUT_SUCCESS_URL: z.url(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  cached ??= schema.parse(process.env)
  return cached
}
