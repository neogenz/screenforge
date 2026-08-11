import { z } from 'zod'

/**
 * Le contrat du pont local, et rien de plus.
 *
 * Le pont est un troisième déployable : un processus qui tourne sur la machine
 * de l'utilisateur, écoute sur `127.0.0.1` et lance `codex app-server`. Ce
 * qu'il expose n'est donc pas une API générale mais **deux verbes** — proposer
 * un plan de campagne, retoucher un écran. Pas de shell, pas de proxy de
 * requêtes arbitraires, pas d'accès au disque : un pont qui accepterait un
 * prompt libre serait une console distante ouverte sur le poste, protégée par
 * un jeton que la page web porte.
 *
 * La version du protocole est comparée à l'octet près des deux côtés. Un pont
 * plus vieux que la page dit ce qu'il est, et la page le dit à l'utilisateur ;
 * deviner aurait produit des champs manquants au milieu d'une génération.
 */

export const PROTOCOL_VERSION = 1

/** Ce qu'un fournisseur sait faire, tel que le pont le déclare. */
export const capabilitiesSchema = z.object({
  /** Le modèle peut lire des images. Aucune n'est envoyée aujourd'hui. */
  vision: z.boolean(),
  /** Le modèle sait rendre du JSON contraint par un schéma. */
  structuredOutput: z.boolean(),
  /** Le modèle expose un effort de raisonnement réglable. */
  reasoning: z.boolean(),
})

export type Capabilities = z.infer<typeof capabilitiesSchema>

export const helloSchema = z.object({
  protocol: z.number().int(),
  bridge: z.string(),
  /** Faux tant que `codex` n'est pas installé : la page le dit au lieu d'attendre. */
  codexAvailable: z.boolean(),
  codexVersion: z.string().optional(),
  capabilities: capabilitiesSchema,
  /** Incrémentée à chaque révocation : un jeton d'une version passée est mort. */
  tokenVersion: z.number().int(),
})

export type Hello = z.infer<typeof helloSchema>

const screenshotSchema = z.object({
  label: z.string().max(60),
  /** Présence seulement : aucune image ne traverse le pont. */
  hasAsset: z.boolean(),
})

export const briefSchema = z.object({
  appName: z.string().min(1).max(60),
  pitch: z.string().max(140),
  direction: z.enum(['sobre', 'contraste', 'chaleureux', 'nocturne']),
  screenshots: z.array(screenshotSchema).max(10),
})

export type BridgeBrief = z.infer<typeof briefSchema>

const backgroundSchema = z.object({
  type: z.literal('solid'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const plannedScreenSchema = z.object({
  name: z.string().min(1).max(60),
  headline: z.string().min(1).max(400),
  slot: z.string().max(48).optional(),
  background: backgroundSchema,
  screenshotIndex: z.number().int().min(0).max(9).optional(),
})

export const planSchema = z.object({
  appName: z.string().min(1).max(60),
  direction: z.enum(['sobre', 'contraste', 'chaleureux', 'nocturne']),
  deviceModel: z.string().max(64),
  screens: z.array(plannedScreenSchema).min(1).max(10),
})

export type BridgePlan = z.infer<typeof planSchema>

/**
 * Le schéma envoyé au modèle pour contraindre sa réponse.
 *
 * `turn/start` accepte un `outputSchema` : le message final est alors du JSON
 * conforme, et non une prose dont il faudrait extraire un objet à coups
 * d'expressions régulières. Le même schéma est revalidé par `planSchema` à
 * l'arrivée — un modèle qui respecte un schéma n'est pas un modèle vérifié.
 */
export const PLAN_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['appName', 'direction', 'deviceModel', 'screens'],
  properties: {
    appName: { type: 'string' },
    direction: { type: 'string', enum: ['sobre', 'contraste', 'chaleureux', 'nocturne'] },
    deviceModel: { type: 'string' },
    screens: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'headline', 'background'],
        properties: {
          name: { type: 'string' },
          headline: { type: 'string' },
          slot: { type: 'string' },
          background: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'color'],
            properties: { type: { type: 'string', enum: ['solid'] }, color: { type: 'string' } },
          },
          screenshotIndex: { type: 'integer' },
        },
      },
    },
  },
} as const

/**
 * La traduction : des chaînes, et rien qui les situe.
 *
 * Ni identifiant de calque, ni nom d'écran, ni projet — le pont reçoit une
 * liste de textes et rend une liste de textes, dans le même ordre. La page seule
 * sait à quel calque chacun revient, ce qui vaut mieux qu'une clé opaque
 * traversant un tiers, et rend l'appel indépendant de la structure du projet.
 */
export const translateRequestSchema = z.object({
  protocol: z.number().int(),
  target: z.object({
    code: z.string().max(16),
    name: z.string().max(40),
    script: z.string().max(24),
  }),
  texts: z.array(z.string().max(400)).min(1).max(120),
})

export type TranslateRequest = z.infer<typeof translateRequestSchema>

export const translationSchema = z.object({ texts: z.array(z.string().max(400)) })

export const TRANSLATION_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['texts'],
  properties: { texts: { type: 'array', items: { type: 'string' } } },
} as const

export const planRequestSchema = z.object({
  protocol: z.number().int(),
  brief: briefSchema,
  deviceModel: z.string().max(64),
  /** Le modèle demandé, choisi dans la liste rendue par `hello`. */
  model: z.string().max(64).optional(),
})

export type PlanRequest = z.infer<typeof planRequestSchema>

export type BridgeErrorCode =
  /** Le jeton manque, ne correspond pas, ou appartient à une version révoquée. */
  | 'unauthorized'
  /** L'origine de la page n'est pas dans l'allowlist du pont. */
  | 'forbidden-origin'
  /** Page et pont ne parlent pas la même version. */
  | 'protocol-mismatch'
  /** `codex` n'est pas installé, ou n'a pas démarré. */
  | 'codex-unavailable'
  /** Codex a répondu, mais pas ce qui était demandé. */
  | 'invalid-response'
  /** La requête a été annulée. */
  | 'cancelled'
  | 'invalid-request'

export interface BridgeError {
  error: BridgeErrorCode
  /** Une phrase actionnable, jamais une trace : elle s'affiche à l'utilisateur. */
  detail: string
}

export const BRIDGE_PORT = 4590
export const BRIDGE_HOST = '127.0.0.1'

/**
 * Les origines admises par défaut.
 *
 * Une page servie ailleurs ne parle pas au pont, même avec un jeton valide :
 * le jeton se recopie, l'origine non. `SCREENFORGE_BRIDGE_ORIGINS` en ajoute
 * pour un déploiement local, jamais un joker.
 */
export const DEFAULT_ORIGINS = [
  'http://localhost:5199',
  'http://127.0.0.1:5199',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

export function allowedOrigins(env: string | undefined = process.env.SCREENFORGE_BRIDGE_ORIGINS) {
  const extra = (env ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*')
  return [...DEFAULT_ORIGINS, ...extra]
}

/** Une requête sans `Origin` vient d'un client qui n'est pas un navigateur. */
export function originAllowed(origin: string | null | undefined, origins: string[]): boolean {
  return typeof origin === 'string' && origins.includes(origin)
}
