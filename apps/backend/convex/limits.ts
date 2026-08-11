import { RateLimiter, HOUR, type RunMutationCtx } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components } from './_generated/api'

/**
 * Les compteurs, tous, et leurs valeurs écrites une seule fois.
 *
 * Ils vivent ici plutôt qu'à côté de chaque fonction pour une raison mesurable :
 * une valeur recopiée dans deux fichiers finit par différer, et un plafond qui
 * diffère de lui-même ne protège plus rien. Chaque compteur naît avec la surface
 * qu'il garde — un compteur sans sa route est du code mort, un compteur ajouté
 * après coup se découvre en production.
 *
 * Ce que Convex Auth couvre déjà, et qu'on ne redouble donc pas : les échecs de
 * vérification d'un mot de passe ou d'un code, bornés par
 * `signIn.maxFailedAttempsPerHour` dans `auth.ts`. Ce qu'il ne couvre pas du
 * tout, et qui est ici : l'**envoi** d'un courriel, la création d'objets chez un
 * tiers payant, et la suppression de compte.
 */
const LIMITS = {
  /**
   * L'envoi d'un lien magique, deux clés pour deux victimes différentes.
   *
   * Par adresse : protège le titulaire d'une boîte contre l'inondation — un
   * balayage change d'adresse à chaque coup et passerait sous cette clé sans
   * jamais la déclencher. Globalement : protège la réputation du domaine
   * expéditeur contre ce balayage-là. La clé qu'on voudrait pour le second est
   * l'IP, et une fonction Convex ne la connaît pas (seule une `httpAction`
   * reçoit des en-têtes) ; le plafond global est ce qui est réellement
   * disponible, posé assez haut pour qu'un usage normal ne le touche jamais.
   */
  magicLinkSend: { kind: 'fixed window', rate: 3, period: HOUR },
  magicLinkSendGlobal: { kind: 'fixed window', rate: 100, period: HOUR },

  /** Chaque appel crée un objet chez Polar. La route est authentifiée, pas gratuite. */
  checkout: { kind: 'fixed window', rate: 10, period: HOUR },

  /** La seule porte vers du stockage facturé. */
  assetUpload: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
  /** Borne le coût récurrent du seul droit qui en a un. */
  projectPush: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 20 },

  /** Geste irréversible, et chaque tentative relance un cycle de nettoyage. */
  accountDeletion: { kind: 'fixed window', rate: 3, period: HOUR },
} as const

export const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS)

/** Les noms déclarés, et rien d'autre : un compteur non déclaré ne compile pas. */
export type LimitName = keyof typeof LIMITS

/** Le code que le client reconnaît ; le texte affiché appartient à l'éditeur. */
export const RATE_LIMITED = 'RATE_LIMITED' as const

/**
 * `type` et non `interface` : la charge d'un `ConvexError` doit être une valeur
 * Convex, donc porter une signature d'index. TypeScript en déduit une pour un
 * alias de type et jamais pour une interface.
 */
export type RateLimitedError = {
  code: typeof RATE_LIMITED
  /** Millisecondes d'attente, telles que le composant les calcule. */
  retryAfter: number
}

/**
 * Consomme un jeton, ou refuse en clair.
 *
 * Le refus lève un `ConvexError` porteur d'un code, jamais le message brut du
 * composant : un utilisateur qui a cliqué trois fois trop vite n'a pas à lire le
 * nom interne d'un compteur, et l'éditeur a besoin d'un code stable pour choisir
 * sa phrase. Le compte est pris dans la transaction de l'appelant — une mutation
 * qui échoue rend son jeton, ce qui est exactement ce qu'on veut d'un envoi de
 * courriel qui n'est jamais parti.
 */
export async function consume(ctx: RunMutationCtx, name: LimitName, key?: string): Promise<void> {
  const status = await rateLimiter.limit(ctx, name, { key })
  if (!status.ok) {
    throw new ConvexError<RateLimitedError>({
      code: RATE_LIMITED,
      retryAfter: status.retryAfter ?? 0,
    })
  }
}
