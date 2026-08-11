/**
 * Qui compose, et à quel prix pour l'utilisateur.
 *
 * Un registre plutôt qu'un `if` : ce qui distingue deux fournisseurs n'est pas
 * seulement leur code d'appel mais **six faits** qu'une interface honnête doit
 * pouvoir énoncer sans lire l'implémentation — le transport, l'authentification,
 * les modèles admis, la vision, les outils, le raisonnement. Écrits ici, ils
 * s'affichent ; dispersés dans les composants, ils deviennent des promesses
 * qu'on oublie de tenir.
 *
 * Le registre reste volontairement court. Deux fournisseurs suffisent à établir
 * la forme, et une abstraction dessinée pour cinq fournisseurs imaginaires
 * aurait été dessinée pour aucun.
 */

export type ProviderTransport =
  /** Rien ne quitte l'onglet. */
  | 'in-process'
  /** Un processus sur la machine de l'utilisateur, sur la boucle locale. */
  | 'local-bridge'

export type ProviderAuth =
  | 'none'
  /** Un jeton tiré par le pont, gardé en mémoire, jamais écrit. */
  | 'pairing-token'

export interface ProviderCapabilities {
  /** Le fournisseur peut lire des images. */
  vision: boolean
  /** Il rend du JSON contraint par un schéma. */
  structuredOutput: boolean
  /** Il expose un effort de raisonnement réglable. */
  reasoning: boolean
  /** Il exécute les outils de l'éditeur lui-même. Aucun ne le fait aujourd'hui :
      tous rendent un plan, que le constructeur déterministe traduit en appels. */
  tools: boolean
}

export interface AiProvider {
  id: ProviderId
  label: string
  /** Une ligne, à afficher telle quelle : ce que ce choix implique. */
  summary: string
  /** Où passent les données. Jamais un euphémisme. */
  dataPath: string
  transport: ProviderTransport
  auth: ProviderAuth
  /**
   * Les modèles admis. Vide = le fournisseur n'en a pas, ou les annonce lui-même
   * à la connexion — le pont rend sa liste, et rien d'autre n'est proposé.
   */
  models: readonly string[]
  capabilities: ProviderCapabilities
  /** Le chemin proposé par défaut. Un seul, sinon ce n'est pas une recommandation. */
  recommended: boolean
}

export type ProviderId = 'local' | 'codex-bridge'

export const AI_PROVIDERS: readonly AiProvider[] = [
  {
    id: 'local',
    label: 'Composition locale',
    summary: 'Immédiate, hors ligne, identique à chaque fois.',
    dataPath: 'Rien ne quitte cet onglet. Aucune requête réseau, aucun compte.',
    transport: 'in-process',
    auth: 'none',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: false, tools: false },
    recommended: true,
  },
  {
    id: 'codex-bridge',
    label: 'Codex, via le pont local',
    summary: 'Les accroches sont rédigées par le modèle. Demande le pont lancé sur votre machine.',
    dataPath:
      'Le nom, la phrase de présentation et les libellés de vos écrans partent vers Codex. Vos captures et votre logo restent ici : aucune image ne traverse le pont.',
    transport: 'local-bridge',
    auth: 'pairing-token',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: true, tools: false },
    recommended: false,
  },
]

export function aiProvider(id: ProviderId): AiProvider {
  return AI_PROVIDERS.find((entry) => entry.id === id) ?? AI_PROVIDERS[0]
}

export const RECOMMENDED_PROVIDER: AiProvider =
  AI_PROVIDERS.find((entry) => entry.recommended) ?? AI_PROVIDERS[0]
