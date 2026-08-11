import type { BridgePlan, Hello } from 'bridge'
import { AI_LIMITS } from '@/lib/ai/tools'
import { normalizeSlot } from '@/lib/slots'
import type { CampaignBrief, CampaignPlan, PlannedScreen } from '@/lib/ai/plan'

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
const PROTOCOL = 2
const BRIDGE_URL = 'http://127.0.0.1:4590'

export type BridgeCapability = 'codex' | 'asc-publish'

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
const sessionTokens: Record<BridgeCapability, string> = { codex: '', 'asc-publish': '' }

export function setBridgeToken(capability: BridgeCapability, token: string): void {
  sessionTokens[capability] = token.trim()
}

export function bridgeToken(capability: BridgeCapability): string {
  return sessionTokens[capability]
}

export type BridgeStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ready'; hello: Hello; models: BridgeModel[] }
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
 */
const UNREACHABLE =
  'Pont injoignable sur 127.0.0.1:4590. Lancez-le avec « pnpm --filter bridge run start ». Une page servie en HTTPS ne peut pas l’atteindre.'

export async function connectBridge(token: string): Promise<BridgeStatus> {
  try {
    const hello = await call<Hello>('/hello', '')
    if (hello.protocol !== PROTOCOL) {
      return {
        state: 'error',
        message: `Le pont parle la version ${hello.protocol}, cette page la ${PROTOCOL}. Mettez-les à jour ensemble.`,
        recoverable: false,
      }
    }
    if (!hello.codexAvailable) {
      return {
        state: 'error',
        message:
          'Le pont tourne, mais la commande « codex » est introuvable. Installez-la et connectez-la.',
        recoverable: false,
      }
    }
    const { models } = await call<{ models: BridgeModel[] }>('/models', token)
    return { state: 'ready', hello, models }
  } catch (cause) {
    if (cause instanceof TypeError)
      return { state: 'error', message: UNREACHABLE, recoverable: true }
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
  model?: string,
): Promise<CampaignPlan> {
  const { plan } = await call<{ plan: BridgePlan }>('/plan', token, {
    method: 'POST',
    body: JSON.stringify({
      protocol: PROTOCOL,
      deviceModel: brief.deviceModel,
      ...(model ? { model } : {}),
      brief: {
        appName: brief.appName,
        pitch: brief.pitch,
        direction: brief.direction,
        // Le libellé et la présence, jamais l'image ni son identifiant.
        screenshots: brief.screenshots.map((shot) => ({
          label: shot.label.slice(0, 60),
          hasAsset: Boolean(shot.assetId),
        })),
      },
    }),
  })

  const screens: PlannedScreen[] = plan.screens
    .slice(0, AI_LIMITS.maxScreens)
    .map((screen, index) => {
      const at = typeof screen.screenshotIndex === 'number' ? screen.screenshotIndex : index
      return {
        name: screen.name.slice(0, AI_LIMITS.maxNameLength),
        headline: screen.headline.slice(0, AI_LIMITS.maxTextLength),
        slot: normalizeSlot(screen.slot || screen.name || `ecran-${index + 1}`),
        background: { type: 'solid', color: screen.background.color },
        screenshotIndex: brief.screenshots[at]?.assetId ? at : undefined,
      }
    })

  return {
    appName: brief.appName,
    direction: brief.direction,
    deviceModel: brief.deviceModel,
    screens,
  }
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
): Promise<string[]> {
  const answer = await call<{ texts: string[] }>('/translate', token, {
    method: 'POST',
    body: JSON.stringify({ protocol: PROTOCOL, target, texts }),
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
