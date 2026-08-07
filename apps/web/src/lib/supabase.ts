import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Le client Supabase, chargé à la demande, ou rien du tout.
 *
 * Deux exigences se croisent ici et expliquent la forme inhabituelle.
 *
 * La première : sans les deux variables d'environnement, ScreenForge est ce
 * qu'il a toujours été — un éditeur local-first, sans compte et sans réseau.
 * Ce n'est pas un état dégradé, c'est le mode par défaut du produit, donc
 * l'absence de client doit être constatable par l'appelant plutôt que déguisée
 * en client qui échouerait à la première requête.
 *
 * La seconde : `@supabase/supabase-js` pèse plus que la moitié de ce que
 * l'éditeur charge aujourd'hui pour dessiner. Un `import` statique le mettrait
 * dans le paquet critique de tout le monde, y compris de qui n'aura jamais de
 * compte — et le chemin critique de cette application est mesuré
 * (`e2e/boot-shell.spec.ts`). D'où l'import dynamique : la couche cloud est
 * additive, elle ne doit pas peser sur ce qu'elle n'ajoute rien.
 *
 * Le corollaire est que rien de synchrone ne peut dépendre du client. C'est à
 * cela que sert `cloudConfigured` : la chrome demande « le compte existe-t-il
 * ici ? » sans rien charger, et seul ce qui s'en sert vraiment attend.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Vite substitue les deux expressions à la compilation : dans une build sans
 * ces variables, ce booléen est une constante `false` et tout ce qu'il garde
 * disparaît à l'élagage.
 */
export const cloudConfigured = Boolean(url && anonKey)

let client: Promise<SupabaseClient<Database>> | null = null

/**
 * `null` quand l'instance n'est pas configurée — jamais une promesse rejetée :
 * l'absence de cloud n'est pas une panne, et un appelant qui doit la gérer la
 * lit mieux dans un `if` que dans un `catch`.
 */
export function getSupabase(): Promise<SupabaseClient<Database>> | null {
  if (!url || !anonKey) return null
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url, anonKey),
  )
  return client
}
