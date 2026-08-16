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
 * Le registre porte aussi ce qu'il faut faire pour brancher chacun. Ce n'est
 * pas de la documentation rangée au mauvais endroit : l'installation guidée
 * affiche ce qu'elle trouve ici, donc un fournisseur ajouté sans sa marche à
 * suivre apparaîtrait comme une case à cocher qui ne marche pas — ce que la
 * version précédente faisait, avec un jeton à trouver dans un terminal que rien
 * ne disait de lancer.
 *
 * Deux familles, et la différence est celle qui compte pour l'utilisateur :
 * **le pont** parle à un programme déjà installé et déjà connecté sur sa
 * machine, sans qu'aucun secret ne traverse la page ; **la clé d'API** envoie le
 * brief à un service, avec une clé qu'il colle ici. Les deux sont proposées, et
 * l'ordre du registre dit laquelle est préférable.
 */

export type ProviderTransport =
  /** Rien ne quitte l'onglet. */
  | 'in-process'
  /** Un processus sur la machine de l'utilisateur, sur la boucle locale. */
  | 'local-bridge'
  /** Une requête sortante depuis l'onglet, vers l'API d'un tiers. */
  | 'direct-api'

export type ProviderAuth =
  | 'none'
  /** Un jeton tiré par le pont, gardé en mémoire, jamais écrit. */
  | 'pairing-token'
  /** Une clé d'API du service, scellée sur la machine — voir `key-store.ts`. */
  | 'api-key'

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

/** Ce qu'il faut poser une fois pour que le fournisseur réponde. */
export interface ProviderSetup {
  /** Ce que l'utilisateur doit déjà avoir. Une ligne, vérifiable par lui. */
  requirement: string
  /** Où l'obtenir s'il ne l'a pas : une adresse, jamais un tutoriel. */
  requirementHref: string
  /** Le libellé du champ secret. */
  secretLabel: string
  /** Ce que le champ attend, quand il est vide. */
  secretPlaceholder: string
  /** Où trouver ce secret, à l'endroit où on le colle. */
  secretHelp: string
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
  /** Le binaire que le pont lance pour ce fournisseur. Absent hors du pont. */
  engine?: EngineId
  /**
   * Les modèles admis. Vide = le fournisseur n'en a pas, ou les annonce lui-même
   * à la connexion — le pont rend sa liste, et rien d'autre n'est proposé.
   */
  models: readonly string[]
  capabilities: ProviderCapabilities
  /** La marche à suivre. Absente pour le fournisseur qui n'en demande aucune. */
  setup?: ProviderSetup
  /** Le chemin proposé par défaut. Un seul, sinon ce n'est pas une recommandation. */
  recommended: boolean
}

export type EngineId = 'claude'

export type ProviderId = 'local' | 'claude-bridge' | 'anthropic' | 'openrouter'

/** La commande qui lance le pont. */
export const BRIDGE_COMMAND = 'pnpm --filter bridge run start'

export const AI_PROVIDERS: readonly AiProvider[] = [
  {
    id: 'local',
    label: 'ScreenForge seul, sans IA',
    summary:
      'Met en page les visuels, mais ne rédige pas : chaque accroche reprend le nom de votre fichier, à réécrire ensuite.',
    dataPath: 'Rien ne quitte cet onglet. Aucune requête réseau, aucun compte.',
    transport: 'in-process',
    auth: 'none',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: false, tools: false },
    recommended: true,
  },
  {
    id: 'claude-bridge',
    label: 'Avec Claude Code, sur votre ordinateur',
    summary:
      'Les accroches sont écrites par Claude, via le Claude Code déjà installé et connecté sur votre machine. Aucune clé à coller.',
    dataPath:
      'Partent vers Claude : le nom, la phrase, la page du produit et les noms de vos fichiers. Restent ici : vos captures et votre logo — aucune image ne traverse le pont.',
    transport: 'local-bridge',
    auth: 'pairing-token',
    engine: 'claude',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: true, tools: false },
    setup: {
      requirement: 'La commande « claude » installée et connectée à votre compte.',
      requirementHref: 'https://claude.com/product/claude-code',
      secretLabel: 'Jeton d’appairage',
      secretPlaceholder: 'Affiché par le pont à son démarrage',
      secretHelp:
        'Le pont affiche un jeton « assistant » à son démarrage. Recopiez-le : il n’est enregistré nulle part, et il faudra le ressaisir au prochain démarrage.',
    },
    recommended: false,
  },
  {
    id: 'anthropic',
    label: 'Avec une clé Anthropic',
    summary:
      'Les accroches sont écrites par Claude, facturées à votre clé. Rien à installer, mais le brief part chez Anthropic.',
    dataPath:
      'Partent vers api.anthropic.com : le nom, la phrase, la page du produit et les noms de vos fichiers. Restent ici : vos captures, votre logo, et votre clé — conservée chiffrée sur cet ordinateur, hors de vos projets.',
    transport: 'direct-api',
    auth: 'api-key',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: false, tools: false },
    setup: {
      requirement: 'Une clé d’API Anthropic, créée dans votre console.',
      requirementHref: 'https://console.anthropic.com/settings/keys',
      secretLabel: 'Clé d’API Anthropic',
      secretPlaceholder: 'sk-ant-…',
      secretHelp:
        'Une fois connectée, elle est chiffrée et conservée sur cet ordinateur : rien à recoller la prochaine fois, et rien qui parte dans vos projets, vos exports ou le Cloud. « Oublier cette clé » l’efface.',
    },
    recommended: false,
  },
  {
    id: 'openrouter',
    label: 'Avec une clé OpenRouter',
    summary:
      'Les accroches sont écrites par le modèle que vous choisissez chez OpenRouter, facturées à votre clé.',
    dataPath:
      'Partent vers openrouter.ai, puis vers le fournisseur du modèle choisi : le nom, la phrase, la page du produit et les noms de vos fichiers. Restent ici : vos captures, votre logo, et votre clé — conservée chiffrée sur cet ordinateur, hors de vos projets.',
    transport: 'direct-api',
    auth: 'api-key',
    models: [],
    capabilities: { vision: false, structuredOutput: true, reasoning: false, tools: false },
    setup: {
      requirement: 'Une clé d’API OpenRouter, créée dans votre tableau de bord.',
      requirementHref: 'https://openrouter.ai/settings/keys',
      secretLabel: 'Clé d’API OpenRouter',
      secretPlaceholder: 'sk-or-v1-…',
      secretHelp:
        'Une fois connectée, elle est chiffrée et conservée sur cet ordinateur : rien à recoller la prochaine fois, et rien qui parte dans vos projets, vos exports ou le Cloud. « Oublier cette clé » l’efface.',
    },
    recommended: false,
  },
]

export function aiProvider(id: ProviderId): AiProvider {
  return AI_PROVIDERS.find((entry) => entry.id === id) ?? AI_PROVIDERS[0]
}

export const RECOMMENDED_PROVIDER: AiProvider =
  AI_PROVIDERS.find((entry) => entry.recommended) ?? AI_PROVIDERS[0]

/**
 * Une page servie ailleurs qu'en local ne peut pas atteindre le pont.
 *
 * Ce n'est pas une préférence mais deux règles que la page ne commande pas : le
 * pont n'admet que des origines locales, et un navigateur refuse une requête
 * `http://127.0.0.1` depuis une page `https`. Le savoir avant d'afficher la
 * marche à suivre évite de faire installer un pont à quelqu'un qui ne pourra
 * jamais s'y connecter depuis cet onglet.
 */
export function bridgeReachable(origin: string = window.location.hostname): boolean {
  return origin === 'localhost' || origin === '127.0.0.1' || origin === '[::1]'
}
