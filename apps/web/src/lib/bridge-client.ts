import type { BridgePlan, Hello } from 'bridge'
import { AI_LIMITS } from '@/lib/ai/tools'
import { automaticArchetype } from '@/lib/ai/archetypes'
import { normalizeSlot } from '@/lib/slots'
import {
  resolvePalette,
  validateBriefGroundingCapacity,
  validateGeneratedPlan,
} from '@/lib/ai/plan'
import type { CampaignBrief, CampaignPlan, PlannedScreen } from '@/lib/ai/plan'
import type { EngineId } from '@/lib/ai/providers'
import { APP_STORE_PROFILE, getStoreTargetProfile } from '@/lib/dimensions'

/**
 * Le client du pont local.
 *
 * **Le jeton d'appairage ne quitte jamais la mémoire de l'onglet.** Ni
 * `localStorage`, ni `sessionStorage`, ni cookie, ni projet, ni Cloud, ni
 * journal : il vit dans une variable de module et meurt avec le rechargement de
 * la page, exactement comme celui du pont meurt avec son processus. Le prix est
 * une saisie par session ; c'est le bon prix pour une clé qui commande un
 * processus sur la machine de l'utilisateur, et c'est précisément ce qu'un
 * `localStorage` — lisible par tout script chargé dans la page, persistant,
 * emporté par les sauvegardes de profil — ne sait pas offrir.
 *
 * `PROTOCOL` est doublé ici plutôt qu'importé : la valeur du paquet `bridge`
 * arrive en `import type`, donc rien de ce paquet n'atteint le navigateur. Le
 * test de compatibilité de version compare les deux, et c'est le pont qui
 * tranche.
 */
const PROTOCOL = 6
const BRIDGE_URL = 'http://127.0.0.1:4590'

export type BridgeCapability = 'assistant' | 'asc-publish'

/**
 * Un jeton par capacité, en mémoire de module.
 *
 * Ici plutôt que dans un état React : deux boîtes s'appairent à la même
 * capacité — la campagne et les langues — et une saisie par boîte aurait fait
 * taper deux fois le même secret. Volontairement pas dans un store Zustand :
 * ceux-là se persistent, s'inspectent depuis la console de développement et
 * voyagent dans les captures d'état.
 *
 * Deux entrées et non une : appairer un assistant n'autorise pas à publier chez
 * Apple, et l'utilisateur qui ne recopie que le premier jeton garde la seconde
 * porte fermée. C'est le pont qui le décide, la page ne fait que ne pas
 * mélanger les deux.
 */
const sessionTokens: Record<BridgeCapability, string> = { assistant: '', 'asc-publish': '' }

/**
 * Le moteur avec lequel l'appairage a été fait, retenu avec le jeton.
 *
 * La boîte des langues traduit par le même pont sans jamais montrer le choix du
 * moteur : la traduction reprend ainsi le même assistant que la campagne.
 */
let sessionEngine: EngineId = 'claude'

export function setBridgeToken(
  capability: BridgeCapability,
  token: string,
  engine?: EngineId,
): void {
  sessionTokens[capability] = token.trim()
  if (engine) sessionEngine = engine
}

export function bridgeToken(capability: BridgeCapability): string {
  return sessionTokens[capability]
}

export function bridgeEngine(): EngineId {
  return sessionEngine
}

export type BridgeStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ready'; hello: Hello; engine: EngineId; models: BridgeModel[] }
  | { state: 'error'; message: string; recoverable: boolean }

export interface BridgeModel {
  id: string
  displayName: string
}

interface BridgeFailure {
  error?: string
  detail?: string
}

/** Un message que l'utilisateur peut suivre, jamais une trace. */
function messageFor(status: number, body: BridgeFailure): string {
  if (body.detail) return body.detail
  if (status === 401) return 'Jeton refusé. Recopiez celui affiché par le pont à son démarrage.'
  if (status === 403)
    return 'Le pont refuse cette origine. Servez ScreenForge en local pour l’utiliser.'
  return `Le pont a répondu ${status}.`
}

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const body = (await response.json().catch(() => ({}))) as BridgeFailure
  if (!response.ok) throw new Error(messageFor(response.status, body))
  return body as T
}

/**
 * Une phrase pour l'échec le plus fréquent, qui n'est pas une erreur HTTP.
 *
 * Un pont éteint ne répond pas : `fetch` rejette sans statut. Dire « échec
 * réseau » n'apprendrait rien ; dire quelle commande lancer, si.
 *
 * Elle nomme deux causes parce que le navigateur les rend indiscernables :
 * une origine refusée renvoie un 403 *sans* en-tête `Access-Control-Allow-Origin`
 * — l'early return du pont est avant les en-têtes CORS — donc le navigateur
 * masque la réponse et `fetch` rejette avec le même `TypeError` qu'un port
 * fermé. Mesuré sur le cas le plus banal qui soit : le pont tournait, la page
 * était servie sur 5173, et l'écran répondait « lancez-le » à quelqu'un qui
 * l'avait lancé. Le pont liste ses origines à son démarrage, d'où le renvoi.
 */
const UNREACHABLE =
  'Pont injoignable sur 127.0.0.1:4590. Lancez-le depuis le dossier ScreenForge avec « pnpm --filter bridge run start ». S’il tourne déjà, il refuse l’adresse de cette page : comparez-la aux origines qu’il liste à son démarrage. Une page servie en HTTPS ne peut pas l’atteindre.'

/**
 * Ce que le pont dit de lui-même, sans jeton.
 *
 * Séparé de `connectBridge` parce que l'installation guidée s'en sert avant
 * qu'un jeton n'existe : savoir que le pont tourne et quels assistants il a
 * trouvés est ce qui transforme la première étape d'une consigne en un état.
 * Auparavant, on collait un jeton pour apprendre que le pont n'était pas lancé.
 */
export async function probeBridge(): Promise<
  | { state: 'up'; hello: Hello }
  | { state: 'down'; message: string }
  | { state: 'mismatch'; message: string }
> {
  try {
    const hello = await call<Hello>('/hello', '')
    if (hello.protocol !== PROTOCOL) {
      return {
        state: 'mismatch',
        message: `Le pont parle la version ${hello.protocol}, cette page la ${PROTOCOL}. Mettez-les à jour ensemble.`,
      }
    }
    return { state: 'up', hello }
  } catch (cause) {
    return {
      state: 'down',
      message:
        cause instanceof TypeError
          ? UNREACHABLE
          : cause instanceof Error
            ? cause.message
            : 'Le pont n’a pas répondu.',
    }
  }
}

/**
 * Appaire, pour un moteur donné.
 *
 * Le moteur commande deux choses : le refus quand il n'est pas installé, et la
 * liste des alias de modèles demandée à Claude Code.
 * Un pont joignable dont le binaire manque est un état à part entière, et le
 * dire vaut mieux que laisser l'échec arriver au moment de générer.
 */
export async function connectBridge(token: string, engine: EngineId): Promise<BridgeStatus> {
  const probe = await probeBridge()
  if (probe.state === 'down') return { state: 'error', message: probe.message, recoverable: true }
  if (probe.state === 'mismatch')
    return { state: 'error', message: probe.message, recoverable: false }

  const { hello } = probe
  if (!hello.engines.some((entry) => entry.id === engine)) {
    return {
      state: 'error',
      message: `Le pont tourne, mais la commande « ${engine} » est introuvable sur cette machine. Installez-la, connectez-la, puis réessayez.`,
      recoverable: false,
    }
  }
  try {
    const { models } = await call<{ models: BridgeModel[] }>(`/models?engine=${engine}`, token)
    return { state: 'ready', hello, engine, models }
  } catch (cause) {
    return {
      state: 'error',
      message: cause instanceof Error ? cause.message : 'Le pont n’a pas répondu.',
      recoverable: true,
    }
  }
}

/**
 * Demande un plan au modèle, et n'accepte que ce que l'éditeur sait poser.
 *
 * Trois champs sont **repris de force** au retour : l'application, la direction
 * et le modèle d'appareil. L'utilisateur les a choisis dans le formulaire ; un
 * modèle qui les modifie ne corrige pas une erreur, il ignore une consigne. Le
 * reste — nom, accroche, rôle, fond — est ce qu'on lui demandait d'écrire.
 */
export async function planViaBridge(
  brief: CampaignBrief,
  token: string,
  engine: EngineId,
  model?: string,
): Promise<CampaignPlan> {
  const expected = Math.max(
    1,
    Math.min(
      brief.screenCount,
      getStoreTargetProfile(brief.target ?? APP_STORE_PROFILE.id).maxScreens,
    ),
  )
  const capacityFailure = validateBriefGroundingCapacity(brief, expected)
  if (capacityFailure) throw new Error(capacityFailure)
  const { plan } = await call<{ plan: BridgePlan }>('/plan', token, {
    method: 'POST',
    body: JSON.stringify({
      protocol: PROTOCOL,
      deviceModel: brief.deviceModel,
      engine,
      ...(model ? { model } : {}),
      brief: {
        target: brief.target ?? APP_STORE_PROFILE.id,
        appName: brief.appName,
        pitch: brief.pitch,
        ...(brief.landingUrl ? { landingUrl: brief.landingUrl } : {}),
        ...(brief.productContext
          ? { productContext: brief.productContext.slice(0, AI_LIMITS.maxProductContextLength) }
          : {}),
        direction: brief.direction,
        screenCount: brief.screenCount,
        // Le libellé et la présence, jamais l'image ni son identifiant.
        screenshots: brief.screenshots.map((shot) => ({
          label: shot.label.slice(0, 60),
          ...(shot.description
            ? {
                description: shot.description.slice(0, AI_LIMITS.maxScreenshotDescriptionLength),
              }
            : {}),
          hasAsset: Boolean(shot.assetId),
        })),
      },
    }),
  })

  /* La palette reste celle du brief, jamais celle que le modèle a rendue : les
     trois couleurs de la campagne appartiennent à l'utilisateur, qui vient de
     les choisir ou de les faire lire dans ses captures. */
  const palette = resolvePalette(brief)
  if (plan.screens.length !== expected) {
    throw new Error(
      `Le pont a rendu ${plan.screens.length} visuel${plan.screens.length > 1 ? 's' : ''} au lieu de ${expected} : rien n’a été repris.`,
    )
  }

  const screens: PlannedScreen[] = plan.screens.map((screen, index) => {
    const at = typeof screen.screenshotIndex === 'number' ? screen.screenshotIndex : index
    return {
      name: screen.name.slice(0, AI_LIMITS.maxNameLength),
      headline: screen.headline.slice(0, AI_LIMITS.maxCampaignHeadlineLength),
      evidence: screen.evidence.slice(0, AI_LIMITS.maxEvidenceLength),
      slot: normalizeSlot(screen.slot || screen.name || `ecran-${index + 1}`),
      screenshotIndex: brief.screenshots[at]?.assetId ? at : undefined,
      layout: automaticArchetype(index, expected, Boolean(brief.screenshots[at]?.assetId)),
    }
  })

  const result: CampaignPlan = {
    target: brief.target ?? 'app-store-iphone',
    appName: brief.appName,
    direction: brief.direction,
    palette,
    deviceModel: brief.deviceModel,
    screens,
  }
  const failure = validateGeneratedPlan(result, brief)
  if (failure) throw new Error(`${failure} Rien n’a été repris.`)
  return result
}

/**
 * Fait traduire un lot de textes, par position.
 *
 * Aucun identifiant de calque ne part : le pont reçoit des chaînes numérotées et
 * en rend autant, la page seule sachant à quoi chacune revient. Un compte
 * différent au retour est refusé par le pont plutôt que rattaché de travers —
 * une accroche décalée d'un écran est pire qu'une traduction absente.
 */
export async function translateViaBridge(
  target: { code: string; name: string; script: string },
  texts: readonly string[],
  token: string,
  engine: EngineId = 'claude',
): Promise<string[]> {
  const answer = await call<{ texts: string[] }>('/translate', token, {
    method: 'POST',
    body: JSON.stringify({ protocol: PROTOCOL, target, texts, engine }),
  })
  if (answer.texts.length !== texts.length) {
    throw new Error('Le pont a rendu un nombre de textes inattendu : rien n’a été repris.')
  }
  return answer.texts
}

/* -------------------------------------------------------------- publication */

export interface AscBridgeStatus {
  available: boolean
  version?: string
  flags: string[]
  /** Vrai quand le pont répond mais que `asc` n'y est pas installé. */
  reachable: boolean
  message?: string
}

/**
 * Ce que le pont sait de `asc`, sans jeton.
 *
 * `hello` est ouvert : la page a besoin de savoir s'il vaut la peine de
 * proposer la publication avant de demander un second secret à l'utilisateur.
 * Elle n'y apprend ni chemin, ni compte, ni identifiant — seulement une version
 * et une liste de drapeaux.
 */
export async function ascBridgeStatus(): Promise<AscBridgeStatus> {
  try {
    const hello = await call<Hello>('/hello', '')
    if (hello.protocol !== PROTOCOL) {
      return {
        available: false,
        reachable: true,
        flags: [],
        message: `Le pont parle la version ${hello.protocol}, cette page la ${PROTOCOL}. Mettez-les à jour ensemble.`,
      }
    }
    return {
      available: hello.ascAvailable,
      reachable: true,
      flags: hello.ascFlags ?? [],
      ...(hello.ascVersion ? { version: hello.ascVersion } : {}),
      ...(hello.ascAvailable
        ? {}
        : {
            message:
              'Le pont tourne, mais la commande « asc » est introuvable. Installez-la puis connectez-la avec « asc auth login ».',
          }),
    }
  } catch (cause) {
    return {
      available: false,
      reachable: false,
      flags: [],
      message: cause instanceof TypeError ? UNREACHABLE : 'Le pont n’a pas répondu.',
    }
  }
}

export interface BridgePublishStep {
  name: string
  status: string
  detail: string
  ms: number
}

export interface BridgePublishResult {
  steps: BridgePublishStep[]
  command: string[]
  idempotent: boolean
  dryRun: boolean
  replaceExisting: boolean
  output: string
}

export interface BridgePublishRequest {
  releaseId: string
  bundleHash: string
  versionLocalization: string
  deviceType: string
  files: { name: string; base64: string }[]
  replaceExisting: boolean
  dryRun: boolean
}

/**
 * Envoie un lot figé au pont, et rien d'autre.
 *
 * Le corps ne porte ni projet, ni instantané, ni identifiant Apple : des
 * planches nommées, leur empreinte collective, et la destination. Le pont ne
 * peut donc rien publier que la page ne lui ait explicitement remis, et la page
 * ne remet que ce qu'elle vient de recalculer depuis la release figée.
 *
 * Une erreur du pont porte ses étapes : dire *où* la publication s'est arrêtée
 * vaut mieux qu'un « échec » sans lieu.
 */
export async function publishViaBridge(
  request: BridgePublishRequest,
  token: string,
): Promise<BridgePublishResult> {
  const response = await fetch(`${BRIDGE_URL}/asc/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      protocol: PROTOCOL,
      releaseId: request.releaseId,
      bundleHash: request.bundleHash,
      target: {
        versionLocalization: request.versionLocalization,
        deviceType: request.deviceType,
      },
      files: request.files,
      replaceExisting: request.replaceExisting,
      dryRun: request.dryRun,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as BridgeFailure & {
    steps?: BridgePublishStep[]
  }
  if (!response.ok) {
    const failure = new Error(messageFor(response.status, body))
    Object.assign(failure, { steps: body.steps ?? [] })
    throw failure
  }
  return body as unknown as BridgePublishResult
}

/** Les étapes rattachées à un échec de publication, s'il en porte. */
export function publishSteps(error: unknown): BridgePublishStep[] {
  return (error as { steps?: BridgePublishStep[] })?.steps ?? []
}
