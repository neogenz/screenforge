import type { ConvexReactClient } from 'convex/react'

/**
 * Le client Convex, chargé à la demande, ou rien du tout.
 *
 * Deux exigences se croisent ici et expliquent la forme inhabituelle.
 *
 * La première : sans l'URL de déploiement, ScreenForge est ce qu'il a toujours
 * été — un éditeur local-first, sans compte et sans réseau. Ce n'est pas un état
 * dégradé, c'est le mode par défaut du produit, donc l'absence de client doit
 * être constatable par l'appelant plutôt que déguisée en client qui échouerait à
 * la première requête.
 *
 * La seconde : le client Convex ouvre une WebSocket et pèse ce qu'il pèse. Un
 * `import` statique le mettrait dans le paquet critique de tout le monde, y
 * compris de qui n'aura jamais de compte — et le chemin critique de cette
 * application est mesuré (`e2e/boot-shell.spec.ts`). D'où l'import dynamique :
 * la couche cloud est additive, elle ne doit pas peser sur ce à quoi elle
 * n'ajoute rien.
 *
 * Le corollaire est que rien de synchrone ne peut dépendre du client. C'est à
 * cela que sert `cloudConfigured` : la chrome demande « le compte existe-t-il
 * ici ? » sans rien charger, et seul ce qui s'en sert vraiment attend.
 */
const url = import.meta.env.VITE_CONVEX_URL

/**
 * Vite substitue l'expression à la compilation : dans une build sans cette
 * variable, ce booléen est une constante `false` et tout ce qu'il garde
 * disparaît à l'élagage.
 */
export const cloudConfigured = Boolean(url)

let client: Promise<ConvexReactClient> | null = null

/**
 * `null` quand l'instance n'est pas configurée — jamais une promesse rejetée :
 * l'absence de cloud n'est pas une panne, et un appelant qui doit la gérer la
 * lit mieux dans un `if` que dans un `catch`.
 *
 * Le module importé est celui que le pont React monte aussi : une seule
 * instance, donc une seule WebSocket et un seul jeton. Deux clients rendraient
 * `ctx.auth` vide dans les appels faits hors de React.
 */
export function getConvex(): Promise<ConvexReactClient> | null {
  if (!url) return null
  client ??= import('@/lib/convex-client').then((module) => module.client)
  return client
}

/**
 * Le code qu'un `ConvexError` porte, ou `null` pour tout le reste.
 *
 * Le serveur refuse en codes (`UNAUTHENTICATED`, `LICENCE_REQUIRED`,
 * `RATE_LIMITED`) et l'éditeur choisit la phrase : un nom de compteur interne
 * n'apprend rien à qui a cliqué trop vite, et un message traduit côté serveur
 * serait une traduction de plus à tenir. La lecture est ici plutôt que recopiée
 * chez chaque appelant parce qu'elle porte une hypothèse sur la forme de
 * l'erreur — deux copies, et l'une des deux cesserait un jour de reconnaître un
 * refus.
 */
export function errorCode(error: unknown): string | null {
  const data: unknown = (error as { data?: unknown })?.data
  if (typeof data === 'object' && data !== null) return (data as { code?: string }).code ?? null
  return null
}
