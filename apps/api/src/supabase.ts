import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.ts'

/**
 * Deux clients, deux rôles, et la distinction n'est pas cosmétique.
 *
 * `serviceClient` court-circuite la RLS. C'est ce qui permet à ce service
 * d'écrire un droit que son titulaire ne peut pas s'accorder lui-même. Il ne
 * doit servir qu'à ça — jamais à lire de la donnée utilisateur au nom d'un
 * appelant, sans quoi on aurait remplacé les policies par des `if`.
 *
 * `verifyToken` fait l'inverse : il ne fait confiance à rien et demande à
 * Supabase qui est le porteur d'un jeton.
 */
let service: SupabaseClient | null = null

export function serviceClient(): SupabaseClient {
  service ??= createClient(env().SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return service
}

export interface AuthedUser {
  id: string
  email: string | null
}

/**
 * `null` quand le jeton ne vaut rien — expiré, forgé, ou d'un autre projet.
 *
 * La vérification passe par Supabase plutôt que par un décodage local de JWT :
 * décoder soi-même ne dit rien d'une session révoquée, et il faudrait tenir à
 * jour la clé de signature du projet.
 */
export async function verifyToken(token: string): Promise<AuthedUser | null> {
  const { data, error } = await serviceClient().auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}
