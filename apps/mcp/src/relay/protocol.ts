import { z } from 'zod'
import type { ToolCall } from '@screenforge/project-format'

/**
 * Le fil entre le démon et l'éditeur ouvert, et rien de plus.
 *
 * Un navigateur ne reçoit pas de connexion entrante : c'est donc la page qui
 * appelle, et le démon qui attend. Deux sens, deux transports — le démon pousse
 * ses demandes dans un flux SSE que la page tient ouvert, la page rend ses
 * réponses en `POST`. Rien ici ne ressemble à une API publique : le seul client
 * légitime est un onglet ScreenForge sur cette machine.
 *
 * Les types voyagent en `import type` jusque dans `apps/web` — zod ne quitte
 * jamais ce paquet, mais une route renommée casse le client à la compilation.
 */

export const RELAY_PROTOCOL = 1
export const RELAY_HOST = '127.0.0.1'
export const DEFAULT_RELAY_PORT = 4591

/**
 * Le port, déplaçable.
 *
 * La machine qui fait tourner la sonde de bout en bout est exactement celle où
 * quelqu'un travaille sur le démon : un port en dur ferait échouer la suite au
 * motif qu'elle marche déjà ailleurs.
 */
export function relayPort(env: string | undefined = process.env.SCREENFORGE_MCP_PORT): number {
  const parsed = Number(env)
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_RELAY_PORT
}

/**
 * Les origines admises, et pourquoi celle du serveur de développement y est.
 *
 * Une origine refusée et un port fermé sont le même événement dans un
 * navigateur : le relais répond 403 avant d'écrire le moindre en-tête CORS,
 * donc `fetch` échoue avec le `TypeError` d'un port qui n'écoute pas. Rien
 * côté page ne sait les distinguer — la liste doit être juste, pas seulement
 * défendable. 5173 est le port de `pnpm run dev`, 4173 celui de `vite
 * preview`, 5199 celui de Playwright.
 */
export const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5199',
  'http://127.0.0.1:5199',
]

export function allowedOrigins(env: string | undefined = process.env.SCREENFORGE_MCP_ORIGINS) {
  const extra = (env ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*')
  return [...DEFAULT_ORIGINS, ...extra]
}

/** Une requête sans `Origin` ne vient pas d'un navigateur. */
export function originAllowed(origin: string | null | undefined, origins: string[]): boolean {
  return typeof origin === 'string' && origins.includes(origin)
}

/** Ce que `POST /pair` rend à une page dont l'origine est admise. */
export interface RelayHello {
  protocol: number
  mcp: string
  token: string
}

export const relayPairSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict()

/**
 * Ce que le démon pousse dans le flux, en un seul événement `calls`.
 *
 * Un lot part entier parce qu'il est appliqué entier : la page le passe à
 * `commitAiRun`, qui valide et écrit en une transaction. Découper le lot en
 * plusieurs événements rendrait au premier refus un projet à moitié écrit.
 */
export interface RelayRequest {
  id: string
  calls?: ToolCall[]
  /**
   * Une lecture d'image plutôt qu'une écriture, jamais les deux.
   *
   * L'agent qui compose à l'aveugle corrige au jugé. Rendre l'écran est la
   * seule chose que le démon ne peut pas faire lui-même : les polices, les
   * gabarits d'appareil et les captures ne vivent que dans l'onglet. La demande
   * emprunte donc le même fil qu'un lot — même corrélation, même délai, même
   * erreur quand l'éditeur n'est pas là.
   */
  render?: RelayRender
  /**
   * Un gabarit à figer, ou la bibliothèque à lire.
   *
   * Trois champs et non trois protocoles : ce qui change d'une demande à
   * l'autre est ce que la page fait, pas comment elle est jointe. Les gabarits
   * vivent dans son IndexedDB — le démon n'en garde aucun, et ne peut donc ni
   * les lister ni les écrire lui-même.
   */
  saveTemplate?: RelayTemplateSave
  listTemplates?: true
  /**
   * Une livraison de captures à reposer sur les appareils qui les portent.
   *
   * Le démon a lu le répertoire et fait entrer chaque fichier dans le coffre ;
   * il n'apparie pas. La règle — manifeste, rôle, préfixe de rang, ambiguïté
   * rendue plutôt que tranchée — sert déjà la boîte « Rafraîchir » dans la
   * page, et une seconde implémentation ici serait d'accord avec elle jusqu'au
   * premier correctif, puis poserait la mauvaise capture sans que rien ne le
   * dise.
   */
  refreshScreenshots?: RelayRefresh
}

export interface RelayRefresh {
  files: RelayRefreshFile[]
  /** `{ rôle: nomDeFichier }`, pour les exports dont les noms sont des horodatages. */
  manifest?: Record<string, string>
}

/** Un fichier déjà offert : la page le récupère par `GET /asset/:id`. */
export interface RelayRefreshFile {
  /** Le nom du fichier, sans son chemin — c'est de lui que le rôle se déduit. */
  name: string
  assetId: string
  width: number
  height: number
}

/**
 * Ce que la page rend après avoir apparié et posé.
 *
 * Les quatre listes que `RefreshPlan` distingue déjà, en phrases : un « 3
 * posées » qui tait les quatre appareils restés vides est un mensonge par
 * omission, et l'agent n'a aucun moyen de le rattraper — il ne voit pas la
 * pellicule.
 */
export interface RelayRefreshed {
  /** Nombre d'appareils dont la capture a changé, en une seule transaction. */
  posed: number
  /** Un appareil par phrase, avec son écran : « Écran 2 · iPhone — rôle « budget ». */
  unmatched: string[]
  /** Appareils sans rôle : jamais appariés automatiquement. */
  slotless: string[]
  /** Rôles réclamés par deux fichiers : aucun n'est posé. */
  ambiguous: string[]
  /** Fichiers qu'aucun appareil ne réclame. */
  unused: string[]
}

export interface RelayTemplateSave {
  name: string
  description?: string
  /** Par défaut, l'écran actif. */
  screenId?: string
}

/** Ce que la page rend pour un gabarit : jamais ses calques, seulement sa fiche. */
export interface RelayTemplateSummary {
  id: string
  name: string
  description: string
  source: 'ai' | 'user'
  layerCount: number
  createdAt: number
}

export interface RelayRender {
  /** Par défaut, l'écran actif. */
  screenId?: string
  /** Borné côté page : une planche fait 440 unités de large, pas 4000. */
  maxWidth?: number
}

/** Ce que la page rend en réponse à un `render`. */
export interface RelayRendered {
  screenId: string
  width: number
  height: number
  /** PNG en base64, sans le préfixe `data:` — c'est ce que MCP transporte. */
  data: string
  /**
   * Ce que la planche a de mesurablement faux, une phrase par défaut.
   *
   * Une image ne dit pas qu'une boîte de 215 px contient cinq lignes : elle
   * montre du texte coupé, ce qui ressemble à un choix. Les constats voyagent
   * donc avec elle, calculés dans l'onglet — il faut la police chargée, le
   * gabarit d'appareil et le fond pour mesurer, et côté Node ce serait une
   * approximation qui mentirait là où l'agent a besoin de vérité.
   *
   * Des phrases et non des codes : c'est l'agent qui les relit, et un
   * `{ kind: 'overflow' }` l'obligerait à connaître un second vocabulaire pour
   * apprendre ce que la phrase dit déjà.
   */
  findings: string[]
}

export const relayResultSchema = z.object({
  id: z.string().min(1).max(64),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(2000).optional(),
})

export type RelayResult = z.infer<typeof relayResultSchema>

/**
 * L'état que la page pousse : à l'ouverture du flux, puis après chaque écriture.
 *
 * Il est poussé et non demandé parce qu'un agent qui lit l'état avant d'agir le
 * fait à chaque tour : un aller-retour SSE par lecture coûterait une latence
 * pour une réponse que la page connaît déjà. `unknown` ici, structuré côté
 * page — le relais transporte, il n'interprète pas.
 */
export const relayStateSchema = z.object({ state: z.unknown() })

export interface RelayError {
  error: 'forbidden-origin' | 'unauthorized' | 'invalid-request' | 'protocol-mismatch'
  detail: string
}
