import { z } from 'zod'

/**
 * Le contrat du pont local, et rien de plus.
 *
 * Le pont est un troisième déployable : un processus qui tourne sur la machine
 * de l'utilisateur, écoute sur `127.0.0.1` et lance l'assistant que cette
 * machine a déjà installé. Ce qu'il expose n'est donc pas une API générale mais
 * **deux verbes** — proposer un plan de campagne, traduire un lot de textes.
 * Pas de shell, pas de proxy de requêtes arbitraires, pas d'accès au disque :
 * un pont qui accepterait un prompt libre serait une console distante ouverte
 * sur le poste, protégée par un jeton que la page web porte.
 *
 * La version du protocole est comparée à l'octet près des deux côtés. Un pont
 * plus vieux que la page dit ce qu'il est, et la page le dit à l'utilisateur ;
 * deviner aurait produit des champs manquants au milieu d'une génération.
 */

export const PROTOCOL_VERSION = 4

/**
 * Les moteurs que le pont sait lancer.
 *
 * Deux binaires, un seul contrat : un prompt entre, du JSON sort. Ce ne sont pas
 * deux fournisseurs mais deux façons d'atteindre le même endroit — la machine
 * de l'utilisateur, avec l'abonnement qu'il y a déjà connecté. C'est aussi
 * pourquoi ils partagent une seule capacité et un seul jeton : appairer « ce
 * pont peut parler à un modèle local » est la décision, pas « lequel ».
 */
export const ENGINES = ['codex', 'claude'] as const

export type EngineId = (typeof ENGINES)[number]

export const engineSchema = z.enum(ENGINES)

/** Un moteur présent sur la machine, tel que le pont l'a sondé. */
export const engineStatusSchema = z.object({
  id: engineSchema,
  version: z.string().max(200).optional(),
})

export type EngineStatus = z.infer<typeof engineStatusSchema>

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
  /**
   * Les moteurs réellement présents, sondés à chaque `hello`.
   *
   * Une liste et non deux booléens : la page affiche ce qu'elle reçoit, donc un
   * moteur ajouté ici apparaît dans l'installation guidée sans qu'un champ soit
   * inventé côté navigateur. Une liste vide veut dire que le pont tourne et
   * qu'aucun assistant n'est installé — un état distinct de « pont éteint », et
   * la page ne dit pas la même chose dans les deux cas.
   */
  engines: z.array(engineStatusSchema),
  capabilities: capabilitiesSchema,
  /** Faux tant que `asc` n'est pas installé : la publication n'est pas proposée. */
  ascAvailable: z.boolean(),
  ascVersion: z.string().optional(),
  /** Ce que ce binaire `asc` sait faire, sondé et non supposé. */
  ascFlags: z.array(z.string()).optional(),
  /**
   * Une version par capacité : un jeton d'une version passée est mort, et
   * révoquer la publication ne coupe pas la conversation avec le modèle.
   */
  tokenVersions: z.object({ assistant: z.number().int(), 'asc-publish': z.number().int() }),
})

export type Hello = z.infer<typeof helloSchema>

const screenshotSchema = z.object({
  label: z.string().max(60),
  /** Description relue : les pixels restent locaux, leur sens peut partir. */
  description: z.string().max(240).optional(),
  /** Présence seulement : aucune image ne traverse le pont. */
  hasAsset: z.boolean(),
})

export const briefSchema = z.object({
  appName: z.string().min(1).max(60),
  pitch: z.string().max(140),
  /**
   * La page du produit, citée au modèle comme contexte.
   *
   * Le pont ne la charge pas et ne la charge jamais : `fetch` sur une URL venue
   * de la page ferait du pont un relais de requêtes sortantes, sur une machine
   * qu'il n'est censé exposer qu'à `codex`. Le modèle en fait ce qu'il peut, ou
   * rien. `http(s)` seulement — un `file:` ou un `data:` n'a rien à dire d'un
   * produit et beaucoup à dire du disque.
   */
  landingUrl: z.string().url().max(2048).startsWith('http').optional(),
  /** Faits copiés puis relus ; jamais le contenu chargé depuis landingUrl. */
  productContext: z.string().max(2400).optional(),
  direction: z.enum(['sobre', 'contraste', 'chaleureux', 'nocturne']),
  /** Combien de visuels le modèle doit proposer. Le plan est borné au même dix. */
  screenCount: z.number().int().min(1).max(10).optional(),
  screenshots: z.array(screenshotSchema).max(10),
})

export type BridgeBrief = z.infer<typeof briefSchema>

/**
 * Ce qu'un visuel vaut au modèle : un nom, une accroche, un rôle, une capture.
 *
 * Pas de couleur de fond. Il en rendait une, et le prompt lui demandait « la
 * même sur tous les visuels sauf raison de composition » — une consigne qui ne
 * pouvait produire qu'un lot d'aplats identiques, sur laquelle il fallait
 * ensuite valider un hexadécimal écrit à la main. La page compose désormais le
 * fond depuis le rang du visuel et la palette que l'utilisateur a choisie ; un
 * champ dont la bonne réponse est connue d'avance n'a rien à faire dans un
 * protocole, il n'y ajoute qu'une façon de se tromper.
 */
const plannedScreenSchema = z.object({
  name: z.string().min(1).max(60),
  headline: z.string().min(1).max(72),
  slot: z.string().max(48).optional(),
  screenshotIndex: z.number().int().min(0).max(9).optional(),
  evidence: z.string().trim().min(1).max(160),
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
        required: ['name', 'headline', 'evidence'],
        properties: {
          name: { type: 'string' },
          headline: { type: 'string' },
          slot: { type: 'string' },
          screenshotIndex: { type: 'integer' },
          evidence: { type: 'string' },
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
  /** Le moteur à lancer. Absent = `codex`, le seul que la version 2 connaissait. */
  engine: engineSchema.optional(),
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
  /** Le modèle demandé, choisi dans la liste que le moteur a rendue. */
  model: z.string().max(64).optional(),
  /** Le moteur à lancer. Absent = `codex`, le seul que la version 2 connaissait. */
  engine: engineSchema.optional(),
})

export type PlanRequest = z.infer<typeof planRequestSchema>

/* ------------------------------------------------------------- publication */

/**
 * La cible d'une publication : trois identifiants, aucun secret.
 *
 * Il n'y a **aucun champ** pour une clé d'API, un identifiant d'émetteur ou un
 * fichier `.p8`, et ce n'est pas un oubli : `asc` résout ses identifiants dans
 * le trousseau du système, donc un champ pour les transporter n'aurait servi
 * qu'à les faire traverser une requête HTTP et un processus de plus. Zod retire
 * ce qu'il ne connaît pas — un appelant qui joindrait une clé la verrait jetée
 * avant que rien n'atteigne la ligne de commande.
 *
 * `deviceType` n'est pas comparé à une liste tenue ici : Apple en ajoute, et une
 * énumération recopiée dérive en silence. La forme est bornée, et `asc` refuse
 * lui-même un type qu'il ne connaît pas — vérifié : « unsupported screenshot
 * display type ». La barrière qui compte est que rien de cette chaîne ne peut
 * ressembler à un argument.
 */
export const ascTargetSchema = z.object({
  versionLocalization: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  deviceType: z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/),
})

export type AscTarget = z.infer<typeof ascTargetSchema>

/**
 * Un fichier du lot : un nom plat et des octets.
 *
 * Le nom ne peut contenir ni séparateur, ni point d'échappement, ni majuscule :
 * la traversée de répertoire est impossible par construction plutôt que
 * rattrapée par une normalisation. Le pont écrit tout dans un seul dossier
 * temporaire, ce qui est exactement ce que `--path` attend.
 */
export const ascFileSchema = z.object({
  name: z.string().regex(/^[0-9a-z][0-9a-z_-]{0,63}\.png$/),
  base64: z.string().max(12_000_000),
})

export const ascPublishRequestSchema = z.object({
  protocol: z.number().int(),
  /** L'identité du lot figé : ce qui rend l'opération idempotente. */
  releaseId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  bundleHash: z.string().regex(/^[a-f0-9]{64}$/),
  target: ascTargetSchema,
  files: z.array(ascFileSchema).min(1).max(10),
  /** Supprime les captures déjà en place. Jamais implicite. */
  replaceExisting: z.boolean().default(false),
  /**
   * `--dry-run` : `asc` dit ce qu'il ferait sans rien changer.
   *
   * Vrai par défaut, et c'est le seul défaut du schéma qui ne soit pas le
   * neutre : omettre le champ doit rendre l'appel inoffensif. À faux, un
   * appelant détenant le jeton `asc-publish` obtenait un téléversement réel
   * pour un champ oublié, et le garde-fou annoncé n'existait que dans la case
   * cochée de la page — c'est-à-dire nulle part, pour tout ce qui n'est pas la
   * page.
   */
  dryRun: z.boolean().default(true),
})

export type AscPublishRequest = z.infer<typeof ascPublishRequestSchema>

export type AscStepName = 'verify-cli' | 'write-temp' | 'upload' | 'cleanup'

export type AscStepStatus = 'ok' | 'failed' | 'skipped' | 'ambiguous'

export const ascStepSchema = z.object({
  name: z.string(),
  status: z.string(),
  /** Une ligne lisible, nettoyée de tout ce qui ressemble à un secret. */
  detail: z.string(),
  ms: z.number().int(),
})

export const ascPublishResultSchema = z.object({
  steps: z.array(ascStepSchema),
  /** La commande réellement lancée, argument par argument, jamais concaténée. */
  command: z.array(z.string()),
  /** Vrai quand le lot avait déjà été publié à cette destination. */
  idempotent: z.boolean(),
  dryRun: z.boolean(),
  replaceExisting: z.boolean(),
  /** Sortie de `asc`, nettoyée. Vide si la commande n'a rien dit. */
  output: z.string(),
})

export type AscPublishResult = z.infer<typeof ascPublishResultSchema>

export type BridgeErrorCode =
  /** Le jeton manque, ne correspond pas, ou appartient à une version révoquée. */
  | 'unauthorized'
  /** L'origine de la page n'est pas dans l'allowlist du pont. */
  | 'forbidden-origin'
  /** Page et pont ne parlent pas la même version. */
  | 'protocol-mismatch'
  /** Le moteur demandé n'est pas installé, ou n'a pas démarré. */
  | 'engine-unavailable'
  /** `asc` n'est pas installé, ou trop ancien pour ce qui est demandé. */
  | 'asc-unavailable'
  /** `asc` a échoué : le détail vient de sa sortie, nettoyée. */
  | 'asc-failed'
  /** Le téléversement n'a pas rendu la main : son sort est inconnu. */
  | 'ambiguous-timeout'
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
 *
 * Les trois ports sont ceux auxquels ScreenForge se sert vraiment : 5173 pour
 * `pnpm run dev`, 4173 pour `pnpm run preview`, 5199 pour Playwright. Le
 * premier manquait, et c'est le seul par lequel on développe : la page se
 * croyait joignable — `bridgeReachable` ne lit que l'hôte — offrait le
 * fournisseur, acceptait le jeton, et le pont refusait l'origine. La liste
 * avait été écrite depuis le banc de test et depuis la prévisualisation, jamais
 * depuis l'application lancée normalement.
 */
export const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5199',
  'http://127.0.0.1:5199',
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
