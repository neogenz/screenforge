import { RateLimiter, HOUR, type RunMutationCtx } from '@convex-dev/rate-limiter'
import { CLOUD_OFFER } from '@screenforge/project-format'
import { ConvexError } from 'convex/values'
import { components } from './_generated/api'
import { env } from './_generated/server'

/**
 * Les compteurs, tous, et leurs valeurs écrites une seule fois.
 *
 * Ils vivent ici plutôt qu'à côté de chaque fonction pour une raison mesurable :
 * une valeur recopiée dans deux fichiers finit par différer, et un plafond qui
 * diffère de lui-même ne protège plus rien. Chaque compteur naît avec la surface
 * qu'il garde — un compteur sans sa route est du code mort, un compteur ajouté
 * après coup se découvre en production.
 *
 * Ce que Convex Auth couvre, et jusqu'où exactement : `maxFailedAttempsPerHour`
 * n'est branché que sur `flow:'signIn'` et sur la vérification d'un code
 * (`retrieveAccountWithCredentials.js` et `verifyCodeAndSignIn.js` sont les deux
 * seuls fichiers de la bibliothèque à importer son `rateLimit.js`).
 * `flow:'signUp'` n'y passe pas, et ce chemin-là rend le compte **existant**
 * quand le secret correspond : la même devinette, sans compteur. C'est
 * `passwordAttempt` qui la borne, dans les deux flux.
 *
 * Ce que la bibliothèque ne couvre pas du tout, et qui est ici : l'**envoi**
 * d'un courriel, la création d'un compte, la création d'objets chez un tiers
 * payant, et la suppression de compte.
 */
/**
 * Cinq essais par heure, et le même nombre des deux côtés.
 *
 * `auth.ts` le repasse à `signIn.maxFailedAttempsPerHour` : le compteur de la
 * bibliothèque reste en place, il couvre simplement un flux sur deux. Deux
 * valeurs écrites séparément se seraient contredites, et la plus permissive
 * aurait décidé — c'est exactement ce que ce fichier existe pour empêcher.
 */
export const PASSWORD_ATTEMPTS_PER_HOUR = 5

export const MAX_PROJECTS_PER_ACCOUNT = CLOUD_OFFER.limits.projects
export const MAX_PROJECT_BYTES_PER_ACCOUNT = CLOUD_OFFER.limits.projectBytes
export const MAX_ASSETS_PER_ACCOUNT = CLOUD_OFFER.limits.assets
export const MAX_ASSET_BYTES_PER_ACCOUNT = CLOUD_OFFER.limits.assetBytes
/** Un compte plein (500 assets / 100 projets) peut être restauré sur une nouvelle machine. */
export const ASSET_DOWNLOADS_PER_HOUR = 600
export const PROJECT_DOWNLOADS_PER_HOUR = 120

const LIMITS = {
  /**
   * Deviner un mot de passe, quel que soit le flux qui sert à le présenter.
   *
   * Consommé **avant** le hachage, pour qu'un essai refusé ne coûte pas le
   * Scrypt qu'il demandait, et remis à zéro par une connexion réussie : seuls
   * les échecs consécutifs s'accumulent, donc cinq fautes de frappe étalées sur
   * l'heure ne condamnent pas un compte actif.
   */
  passwordAttempt: { kind: 'fixed window', rate: PASSWORD_ATTEMPTS_PER_HOUR, period: HOUR },

  /**
   * Créer un compte, globalement.
   *
   * L'inscription par mot de passe n'attend ni courriel ni tiers : elle insère
   * quatre documents et exécute un Scrypt délibérément coûteux, sans que rien
   * ne temporise. Par adresse, un compteur ne servirait à rien — un balayage
   * change d'adresse à chaque coup, exactement l'argument déjà écrit pour
   * `magicLinkSend`. La clé qu'on voudrait est l'IP, qu'une action Convex ne
   * connaît pas. Le plafond global est donc la mesure réellement disponible, et
   * il est posé assez haut pour qu'un jour de lancement ne le touche jamais.
   * Le prix assumé, symétrique de celui du lien magique : un balayage peut
   * fermer l'inscription par mot de passe pour une heure, pendant laquelle les
   * deux SSO et le lien magique restent ouverts.
   */
  passwordSignUpGlobal: { kind: 'fixed window', rate: 200, period: HOUR },

  /**
   * L'envoi d'un lien magique, trois clés pour trois formes d'abus.
   *
   * Par adresse : protège le titulaire d'une boîte contre l'inondation — un
   * balayage change d'adresse à chaque coup et passerait sous cette clé sans
   * jamais la déclencher. Par source réseau pseudonymisée : protège la
   * réputation du domaine sans créer de coupe-circuit mondial. Globalement :
   * borne le coût restant quand l'attaquant fait tourner les deux autres clés.
   */
  magicLinkSend: { kind: 'fixed window', rate: 3, period: HOUR },
  magicLinkSendBySource: { kind: 'fixed window', rate: 20, period: HOUR },
  /* Même budget maximal la première heure (30 initiaux + 70 régénérés), mais
     sans panne figée d'une heure : un abus distribué doit rester actif pour
     consommer les jetons qui reviennent progressivement. */
  magicLinkSendGlobal: { kind: 'token bucket', rate: 70, period: HOUR, capacity: 30 },

  /** OAuth starts persist a verifier before the browser reaches Google or GitHub. */
  oauthStartBySource: { kind: 'fixed window', rate: 30, period: HOUR },
  oauthStartGlobal: { kind: 'fixed window', rate: 500, period: HOUR },

  /** Admission du webhook avant lecture du corps et vérification Node. */
  polarWebhookBySource: { kind: 'token bucket', rate: 120, period: HOUR, capacity: 30 },
  /** Coupe-circuit de dernier recours contre une rotation distribuée des sources. */
  polarWebhookGlobal: { kind: 'fixed window', rate: 500, period: HOUR },

  /** Chaque appel crée un objet chez Polar. La route est authentifiée, pas gratuite. */
  checkout: { kind: 'fixed window', rate: 10, period: HOUR },

  /** La seule porte vers du stockage facturé. */
  assetUpload: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
  /** Borne le coût récurrent du seul droit qui en a un. */
  projectPush: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 20 },

  /** L'egress reste disponible après expiration, mais pas sans borne de coût. */
  assetDownload: { kind: 'fixed window', rate: ASSET_DOWNLOADS_PER_HOUR, period: HOUR },
  projectDownload: { kind: 'fixed window', rate: PROJECT_DOWNLOADS_PER_HOUR, period: HOUR },

  /** Geste irréversible, et chaque tentative relance un cycle de nettoyage. */
  accountDeletion: { kind: 'fixed window', rate: 3, period: HOUR },
  /** Geste destructif borné; les reprises d'un job existant ne le recomptent pas. */
  cloudDataClear: { kind: 'fixed window', rate: 3, period: HOUR },
} as const

export const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS)

/** Les noms déclarés, et rien d'autre : un compteur non déclaré ne compile pas. */
export type LimitName = keyof typeof LIMITS

export const USER_SCOPED_LIMITS = [
  'checkout',
  'assetUpload',
  'projectPush',
  'assetDownload',
  'projectDownload',
  'accountDeletion',
  'cloudDataClear',
] as const satisfies readonly LimitName[]

export const EMAIL_SCOPED_LIMITS = [
  'magicLinkSend',
  'passwordAttempt',
] as const satisfies readonly LimitName[]

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Remove only the component keys that belong to the departing account. */
export async function resetAccountLimits(
  ctx: RunMutationCtx,
  userId: string,
  email?: string,
): Promise<void> {
  await Promise.all([
    ...USER_SCOPED_LIMITS.map((name) => rateLimiter.reset(ctx, name, { key: userId })),
    ...(email
      ? EMAIL_SCOPED_LIMITS.map((name) =>
          rateLimiter.reset(ctx, name, { key: normalizeEmail(email) }),
        )
      : []),
  ])
}

/** Le code que le client reconnaît ; le texte affiché appartient à l'éditeur. */
export const RATE_LIMITED = 'RATE_LIMITED' as const

export type AbuseScope = 'auth' | 'polar'

export type RequestMetadataCtx = {
  meta: { getRequestMetadata(): Promise<{ ip: string | null }> }
}

/** HMAC cloisonné : la valeur persistée ne révèle jamais l'adresse réseau. */
export async function deriveSourceKey(
  ip: string,
  scope: AbuseScope,
  secret: string,
): Promise<string> {
  if (!ip || !secret) throw new Error('ABUSE_PROTECTION_UNAVAILABLE')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`screenforge:${scope}:v1\0${ip}`)),
  )
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** La source vient de Convex, jamais d'un en-tête fourni par l'appelant. */
export async function sourceRateLimitKey(
  ctx: RequestMetadataCtx,
  scope: AbuseScope,
): Promise<string> {
  const { ip } = await ctx.meta.getRequestMetadata()
  return deriveSourceKey(ip ?? '', scope, env.ABUSE_KEY_SECRET?.trim() ?? '')
}

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

/** Reconnaît la charge sérialisée à travers une frontière action/mutation. */
export function rateLimitedError(error: unknown): RateLimitedError | null {
  const direct = (error as { data?: unknown })?.data
  if (
    typeof direct === 'object' &&
    direct !== null &&
    (direct as { code?: unknown }).code === RATE_LIMITED
  ) {
    const retryAfter = (direct as { retryAfter?: unknown }).retryAfter
    return { code: RATE_LIMITED, retryAfter: typeof retryAfter === 'number' ? retryAfter : 0 }
  }
  try {
    const parsed: unknown = JSON.parse(String((error as { message?: unknown })?.message ?? ''))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { code?: unknown }).code === RATE_LIMITED
    ) {
      const retryAfter = (parsed as { retryAfter?: unknown }).retryAfter
      return { code: RATE_LIMITED, retryAfter: typeof retryAfter === 'number' ? retryAfter : 0 }
    }
  } catch {
    // Not a serialized ConvexError.
  }
  return null
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

/**
 * Remet une clé à zéro : un succès efface l'ardoise.
 *
 * Ce qu'un compteur d'échecs demande et qu'une simple consommation ne donne
 * pas. Sans lui, un plafond posé sur chaque tentative — et non sur les seuls
 * échecs — condamnerait un compte actif dès qu'il se connecte assez souvent.
 */
export async function clear(ctx: RunMutationCtx, name: LimitName, key?: string): Promise<void> {
  await rateLimiter.reset(ctx, name, { key })
}
