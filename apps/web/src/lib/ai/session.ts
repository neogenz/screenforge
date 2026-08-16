import { forgetOnDisk, recallFromDisk, rememberOnDisk } from '@/lib/ai/key-store'
import type { ProviderId } from '@/lib/ai/providers'

/**
 * L'appairage tient la session, pas la boîte de dialogue.
 *
 * L'état vivait en `useState` dans `CampaignDialog`, donc il mourait au
 * démontage : fermer la boîte, ou simplement générer (ce qui la ferme), et il
 * fallait relancer le pont, recoller le jeton, rechoisir le modèle. Une session
 * qui dure le temps d'un clic n'est pas une session. Le module tient donc
 * l'état, et la boîte l'y lit et l'y réécrit.
 *
 * Ce que ce module garde en mémoire vaut pour l'onglet. Ce qui doit valoir plus
 * longtemps — une clé d'API, le fournisseur et le modèle choisis — descend dans
 * `key-store.ts`, scellé, et remonte ici au premier appel de
 * `restoreAssistant()`. La frontière est nette et tient en une phrase : **ce
 * module dit ce que la session porte, `key-store.ts` dit ce qui survit et
 * comment.**
 *
 * Deux choses ne descendent jamais. Le jeton du pont, tiré à son démarrage et
 * mort avec son processus : l'écrire le rendrait faux au premier redémarrage.
 * L'état de connexion et son catalogue de modèles, qui sont le résultat d'une
 * requête et non un réglage : les restituer ferait afficher « connecté » sur une
 * clé peut-être révoquée depuis.
 */

export interface AssistantModel {
  id: string
  displayName: string
}

/** L'état d'appairage, le même quel que soit le fournisseur derrière. */
export type AssistantConnection =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ready'; models: AssistantModel[]; detail: string }
  | { state: 'error'; message: string }

export interface AssistantSession {
  providerId: ProviderId
  secret: string
  connection: AssistantConnection
  model: string
}

const BLANK: AssistantSession = {
  providerId: 'local',
  secret: '',
  connection: { state: 'idle' },
  model: '',
}

const session: AssistantSession = { ...BLANK }

/**
 * La session n'a encore rien reçu de personne.
 *
 * Constaté et non mémorisé par un drapeau : la boîte réécrit la session dès son
 * montage, avec les valeurs qu'elle vient d'en lire, et un drapeau « touché »
 * serait levé par cette écriture-là — celle qui ne change rien — avant même que
 * le disque ait répondu. Ce qui décide est donc l'état, pas l'historique.
 */
function untouched(): boolean {
  return session.providerId === BLANK.providerId && session.secret === '' && session.model === ''
}

/**
 * `checking` ne survit jamais : c'est l'état d'une requête en vol, et la
 * requête, elle, ne traverse pas le démontage. Rouvrir la boîte sur un bouton
 * qui tourne indéfiniment serait pire que la repartir de zéro.
 */
export function assistantSession(): AssistantSession {
  return session.connection.state === 'checking'
    ? { ...session, connection: { state: 'idle' } }
    : { ...session }
}

/**
 * Reprend l'appairage retenu, puis rend la session à jour.
 *
 * Une promesse et non une lecture synchrone parce que la boîte est chargée à la
 * demande : le module et le composant arrivent dans la même tournée, donc lire
 * le disque au chargement du module et l'espérer arrivé au montage serait une
 * course perdue une fois sur deux. Ce qui a été saisi entre-temps gagne — la
 * reprise est un défaut, pas une autorité.
 */
let restoring: Promise<AssistantSession> | null = null

async function hydrate(): Promise<AssistantSession> {
  const stored = await recallFromDisk()
  if (stored && untouched()) {
    session.providerId = stored.providerId
    session.secret = stored.secret
    session.model = stored.model
  }
  return assistantSession()
}

export function restoreAssistant(): Promise<AssistantSession> {
  restoring ??= hydrate()
  return restoring
}

/**
 * Ne descend sur le disque que ce qui a répondu.
 *
 * La condition est `ready` et rien d'autre, et elle porte les deux sens. Elle
 * empêche d'écrire une clé à demi tapée, un caractère par frappe. Et elle
 * empêche surtout l'inverse : la boîte s'ouvre en `idle` avec la clé reprise du
 * disque, donc un enregistrement inconditionnel effacerait, à chaque ouverture,
 * exactement ce qu'on vient de restituer.
 */
export function rememberAssistant(patch: Partial<AssistantSession>): void {
  Object.assign(session, patch)
  if (session.connection.state !== 'ready') return
  void rememberOnDisk({
    providerId: session.providerId,
    model: session.model,
    secret: session.secret,
  })
}

/** Oublier ici et sur le disque : un seul geste, sinon ce n'est pas un oubli. */
export function forgetAssistant(): void {
  restoring = null
  Object.assign(session, BLANK)
  void forgetOnDisk()
}
