import type { RelayHello, RelayRequest } from 'mcp'
import {
  applyRelayBatch,
  listRelayTemplates,
  readProjectState,
  refreshRelayScreenshots,
  renderRelayScreen,
  saveRelayTemplate,
} from '@/lib/mcp/session'
import { useMcpStore } from '@/stores/mcp.store'
import { useProjectStore } from '@/stores/project.store'

/**
 * Le fil sortant vers le démon MCP, tenu par l'onglet.
 *
 * Un navigateur ne reçoit pas de connexion entrante : c'est donc la page qui
 * appelle et le démon qui attend. Elle ouvre un flux `EventSource` par lequel
 * arrivent les lots, et rend chaque réponse en `POST`. Rien n'écoute ici, rien
 * n'est exposé : le seul lien avec l'extérieur est celui que l'utilisateur a
 * demandé, et il meurt avec l'onglet.
 *
 * **Le jeton ne quitte jamais la mémoire de ce module** — ni `localStorage`, ni
 * store, ni projet, ni Cloud. Il est reminté à chaque appairage, et un démon
 * relancé en émet un autre : le persister rendrait une valeur périmée au
 * prochain chargement, pour le seul bénéfice de ne pas refaire un appel que
 * l'utilisateur ne voit pas. Seul le *choix* d'activer le mode est mémorisé.
 *
 * `RELAY_PROTOCOL` et `DEFAULT_PORT` sont doublés plutôt qu'importés : les
 * valeurs du paquet `mcp` vivent à côté de schémas zod, et l'`import type`
 * garantit que rien de ce paquet n'atteint le bundle. La comparaison de version
 * confronte les deux copies, et c'est le démon qui tranche.
 */
const RELAY_PROTOCOL = 1
const DEFAULT_PORT = 4591
export const MCP_COMMAND = 'pnpm --filter mcp run start'

/** Le choix de l'utilisateur, pas son jeton. */
const ENABLED_KEY = 'screenforge-mcp'

/**
 * Le port, déplaçable des deux côtés.
 *
 * `SCREENFORGE_MCP_PORT` déplace celui du démon ; sans pendant côté page, cette
 * option serait un mensonge — l'onglet continuerait d'appeler 4591. Une page
 * statique ne lit pas de variable d'environnement, donc c'est le stockage local
 * de l'utilisateur qui porte la valeur. Pas de champ dans l'interface : c'est
 * un réglage de machine, pas une préférence de projet, et le défaut est bon
 * partout ailleurs.
 */
const PORT_KEY = 'screenforge-mcp-port'

/**
 * Le rythme des reprises, jusqu'à un quart de minute.
 *
 * Un démon qu'on relance revient en quelques secondes ; un démon qu'on n'a pas
 * l'intention de rallumer ne doit pas coûter une requête par seconde pendant
 * toute une session d'édition.
 */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000]

/**
 * Le délai avant de repousser l'état après une retouche à la souris.
 *
 * L'état part après chaque écriture de l'agent, mais aussi après les nôtres :
 * un agent qui lit le projet entre deux de ses tours doit y voir ce que
 * l'utilisateur vient de déplacer, sans quoi il compose contre une version
 * périmée. Groupé, parce qu'un glissement de calque produit une écriture par
 * image et qu'aucune des intermédiaires n'intéresse personne.
 */
const STATE_DEBOUNCE_MS = 400

let source: EventSource | null = null
let token = ''
let attempt = 0
let timer: ReturnType<typeof setTimeout> | undefined
let stateTimer: ReturnType<typeof setTimeout> | undefined
let unwatch: (() => void) | undefined
const answerControllers = new Set<AbortController>()
/**
 * Le cycle de connexion courant.
 *
 * Appairer est asynchrone et se coupe n'importe où : sans ce compteur, un
 * « Désactiver » pendant l'appel à `/pair` laissait la réponse arriver après
 * coup, ouvrir un flux et rallumer un mode que l'utilisateur venait d'éteindre.
 */
let cycle = 0

function relayUrl(): string {
  let port = DEFAULT_PORT
  try {
    const stored = Number(localStorage.getItem(PORT_KEY))
    if (Number.isInteger(stored) && stored > 0 && stored < 65536) port = stored
  } catch {
    // Stockage refusé (mode privé strict) : le port par défaut reste juste.
  }
  return `http://127.0.0.1:${port}`
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function persistEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch (error) {
    console.warn('Could not persist the MCP mode.', error)
  }
}

/**
 * Un démon éteint et une origine refusée sont le même événement.
 *
 * Le relais répond 403 avant d'écrire le moindre en-tête CORS, donc le
 * navigateur retient la réponse et `fetch` rejette avec le `TypeError` d'un
 * port qui n'écoute pas. Rien ici ne sait les distinguer : le message nomme les
 * deux causes plutôt que d'en deviner une.
 */
const UNREACHABLE = `Le démon MCP ne répond pas. Lancez « ${MCP_COMMAND} », et vérifiez que l’origine de cette page figure dans la liste qu’il affiche au démarrage.`

class RelayResponseError extends Error {
  constructor(readonly status: number) {
    super(`Le démon a répondu ${status}.`)
  }
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${relayUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) throw new RelayResponseError(response.status)
}

/**
 * Le fichier local que l'agent a désigné, récupéré une fois.
 *
 * Une URL et non un chemin : la page n'a jamais su où le fichier était, et le
 * démon ne sert que ce qu'un appel d'outil a fait entrer dans son coffre.
 */
async function fetchAsset(id: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${relayUrl()}/asset/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!response.ok) throw new Error(`Le démon a répondu ${response.status}.`)
  return response.blob()
}

async function pair(code: string): Promise<RelayHello> {
  const response = await fetch(`${relayUrl()}/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!response.ok) throw new RelayResponseError(response.status)
  return (await response.json()) as RelayHello
}

function armReconnect(mine: number): void {
  const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
  attempt += 1
  timer = setTimeout(() => {
    timer = undefined
    void reconnect(mine)
  }, wait)
}

/** Coupe tout ce qui est en vol, sans toucher au choix de l'utilisateur. */
function teardown(): void {
  cycle += 1
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  if (stateTimer !== undefined) clearTimeout(stateTimer)
  stateTimer = undefined
  unwatch?.()
  unwatch = undefined
  source?.close()
  source = null
  for (const controller of answerControllers) controller.abort()
  answerControllers.clear()
  token = ''
}

async function open(code: string): Promise<void> {
  teardown()
  const mine = cycle
  useMcpStore.getState().setConnectionStep('daemon')
  useMcpStore.getState().setDaemonVersion('')
  useMcpStore.getState().setStatus('connecting')

  let hello: RelayHello
  try {
    hello = await pair(code)
  } catch (error) {
    if (mine !== cycle) return
    const refused = error instanceof RelayResponseError && error.status === 401
    useMcpStore.getState().setConnectionStep(refused ? 'pairing' : 'daemon')
    useMcpStore
      .getState()
      .setStatus('error', refused ? 'Code invalide, expiré ou temporairement bloqué.' : UNREACHABLE)
    return
  }
  if (mine !== cycle) return
  useMcpStore.getState().setDaemonVersion(hello.mcp)

  // Rien à reprendre sur un écart de version : réessayer produirait le même
  // refus toutes les quinze secondes. La phrase dit quoi faire, et on s'arrête.
  if (hello.protocol !== RELAY_PROTOCOL) {
    useMcpStore
      .getState()
      .setStatus(
        'error',
        `Le démon parle le protocole ${hello.protocol}, cette page le ${RELAY_PROTOCOL}. Mettez ScreenForge et le démon à la même version.`,
      )
    return
  }

  token = hello.token
  useMcpStore.getState().setConnectionStep('editor')
  listen(mine)
}

function listen(mine: number): void {
  const stream = new EventSource(`${relayUrl()}/events?token=${encodeURIComponent(token)}`)
  source = stream

  stream.onopen = () => {
    if (mine !== cycle) return
    attempt = 0
    void finishOpening(stream, mine)
  }

  stream.addEventListener('calls', (event) => {
    if (mine !== cycle) return
    void answer(JSON.parse((event as MessageEvent<string>).data) as RelayRequest)
  })

  // Le flux ne distingue pas panne et bearer périmé. Le probe authentifié de
  // reconnexion le fait sans remint implicite.
  stream.onerror = () => {
    if (mine !== cycle) return
    retry(stream, mine)
  }
}

async function finishOpening(stream: EventSource, mine: number): Promise<void> {
  try {
    if (!(await pushState(mine)) || source !== stream) return
    useMcpStore.getState().setConnectionStep('ready')
    useMcpStore.getState().setStatus('live')
    unwatch = useProjectStore.subscribe(scheduleStatePush)
  } catch {
    retry(stream, mine)
  }
}

function retry(stream: EventSource, mine: number): void {
  if (mine !== cycle || source !== stream) return
  stream.close()
  source = null
  unwatch?.()
  unwatch = undefined
  useMcpStore.getState().setConnectionStep('editor')
  useMcpStore.getState().setStatus('connecting')
  armReconnect(mine)
}

async function reconnect(mine: number): Promise<void> {
  if (mine !== cycle || !token) return
  try {
    await post('/state', { state: readProjectState() })
    if (mine === cycle) listen(mine)
  } catch (error) {
    if (mine !== cycle) return
    if (error instanceof RelayResponseError && error.status === 401) {
      teardown()
      useMcpStore.getState().setConnectionStep('pairing')
      useMcpStore.getState().setStatus('error', 'La session a expiré. Saisissez le nouveau code.')
      return
    }
    armReconnect(mine)
  }
}

/**
 * Une demande, cinq formes, une seule réponse.
 *
 * Un lot écrit dans le projet ; un rendu le lit ; un gabarit se range à côté ;
 * une livraison de captures repose sur ce qui existe déjà.
 * Le fil ne les distingue que par le champ présent, et c'est volontaire : la
 * corrélation, le délai et les trois façons dont l'éditeur peut disparaître
 * sont les mêmes pour toutes, et les dédoubler aurait dupliqué tout cela pour
 * une différence de quelques `if`.
 */
async function answer(request: RelayRequest): Promise<void> {
  const mine = cycle
  const controller = new AbortController()
  answerControllers.add(controller)
  const isCurrent = () => mine === cycle && !controller.signal.aborted
  const loadAsset = (id: string) => fetchAsset(id, controller.signal)
  const writesProject = !request.render && !request.saveTemplate && !request.listTemplates
  try {
    const outcome = request.render
      ? await renderRelayScreen(request.render)
      : request.saveTemplate
        ? await saveRelayTemplate(request.saveTemplate, controller.signal)
        : request.listTemplates
          ? await listRelayTemplates()
          : request.refreshScreenshots
            ? await refreshRelayScreenshots(request.refreshScreenshots, loadAsset, isCurrent)
            : await applyRelayBatch(request.calls ?? [], loadAsset, isCurrent)
    if (!isCurrent()) return
    await post(
      '/result',
      {
        id: request.id,
        ok: outcome.committed,
        ...(outcome.committed ? { result: outcome.result } : { error: outcome.error }),
      },
      controller.signal,
    )
    if (!isCurrent()) return
    // Seule une écriture dans le projet change l'état : le repousser après une
    // lecture ou un gabarit rangé ne dirait rien de neuf.
    if (outcome.committed && writesProject) await pushState(mine, controller.signal)
  } catch (error) {
    if (!isCurrent()) return
    // Le lot est appliqué ; c'est le retour qui s'est perdu. L'agent verra son
    // appel expirer, et le flux se rétablira tout seul — rien à défaire ici.
    console.warn('Could not answer the MCP daemon.', error)
  } finally {
    answerControllers.delete(controller)
  }
}

async function pushState(mine = cycle, signal?: AbortSignal): Promise<boolean> {
  if (!token || mine !== cycle) return false
  // Le groupement en attente n'a plus rien à dire : on part avec l'état d'après.
  if (stateTimer !== undefined) clearTimeout(stateTimer)
  stateTimer = undefined
  await post('/state', { state: readProjectState() }, signal)
  return mine === cycle
}

function scheduleStatePush(): void {
  if (stateTimer !== undefined) clearTimeout(stateTimer)
  stateTimer = setTimeout(() => {
    stateTimer = undefined
    void pushState().catch(() => {
      // Le flux dira lui-même qu'il est tombé ; inutile de le dire deux fois.
    })
  }, STATE_DEBOUNCE_MS)
}

/** Le geste : on appaire, on ouvre, on se souvient du choix. */
export async function enableMcp(code: string): Promise<void> {
  persistEnabled(true)
  useMcpStore.getState().setEnabled(true)
  await open(code)
}

/** Le geste inverse révoque le démon puis oublie la capacité locale. */
export async function disableMcp(): Promise<void> {
  persistEnabled(false)
  const presented = token
  teardown()
  useMcpStore.getState().setEnabled(false)
  useMcpStore.getState().setConnectionStep('daemon')
  useMcpStore.getState().setDaemonVersion('')
  useMcpStore.getState().setStatus('off')
  if (!presented) return
  await fetch(`${relayUrl()}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${presented}` },
  }).catch(() => undefined)
}

/** Adresse locale visible dans les détails, sans le jeton de session. */
export function mcpRelayAddress(): string {
  return relayUrl()
}

/**
 * Au démarrage, et seulement si le choix a déjà été fait.
 *
 * Aucun appairage automatique sans ce drapeau : une requête sortante déclenchée
 * par le seul fait d'ouvrir l'application serait une surprise, et laisser un
 * agent écrire dans le projet doit rester une décision.
 */
export function resumeMcp(): () => void {
  if (readEnabled()) {
    useMcpStore.getState().setEnabled(true)
    useMcpStore.getState().setConnectionStep('pairing')
    useMcpStore.getState().setStatus('error', 'Saisissez le code affiché par le démon MCP.')
  }
  return () => teardown()
}
