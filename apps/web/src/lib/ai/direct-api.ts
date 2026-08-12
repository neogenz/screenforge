import { AI_LIMITS } from '@/lib/ai/tools'
import { automaticArchetype } from '@/lib/ai/archetypes'
import { normalizeSlot } from '@/lib/slots'
import { resolvePalette, validateGeneratedPlan } from '@/lib/ai/plan'
import type { CampaignBrief, CampaignPlan, PlannedScreen } from '@/lib/ai/plan'
import type { ProviderId } from '@/lib/ai/providers'

/**
 * Les fournisseurs joignables sans rien installer, et ce qu'ils coûtent.
 *
 * Le pont demande un binaire et un terminal ; ces deux-là demandent une clé.
 * C'est le seul chemin de ScreenForge où un secret de l'utilisateur passe par
 * la page, et il est ici plutôt que dans `bridge-client` pour que cette
 * différence reste lisible dans l'arborescence.
 *
 * **Ce module ne garde la clé qu'en mémoire.** Ce qui la fait survivre à
 * l'onglet est ailleurs et volontairement : `key-store.ts` la scelle en AES-GCM
 * sous une clé non extractible, dans une base distincte de celle des projets.
 * Ici elle est juste la valeur qu'on met dans un en-tête ; là-bas se décide ce
 * qui est écrit, ce qui ne l'est jamais (le jeton du pont, l'état de connexion)
 * et contre quoi ça protège.
 *
 * Ce que ces deux fournisseurs ne font pas : voir les captures. Le brief part,
 * les images restent, comme sur le pont. Ce n'est pas une limite technique ici
 * — les deux savent lire des images — mais la même règle appliquée partout :
 * `palette.ts` lit les couleurs dans l'onglet, et le modèle écrit les mots.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1'

/** La version d'API d'Anthropic, exigée sur chaque requête. */
const ANTHROPIC_VERSION = '2023-06-01'

export type ApiProviderId = Extract<ProviderId, 'anthropic' | 'openrouter'>

const keys: Record<ApiProviderId, string> = { anthropic: '', openrouter: '' }

export function setApiKey(provider: ApiProviderId, key: string): void {
  keys[provider] = key.trim()
}

export function apiKey(provider: ApiProviderId): string {
  return keys[provider]
}

export interface ApiModel {
  id: string
  displayName: string
}

/**
 * Ce que la page a besoin de savoir d'une clé avant de s'en servir.
 *
 * `models` vient du service, jamais d'une liste recopiée ici : un catalogue
 * codé en dur se périme au premier modèle sorti, et proposer un identifiant que
 * le fournisseur a retiré produit une erreur au moment de générer plutôt qu'au
 * moment de choisir.
 */
export type ApiStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ready'; models: ApiModel[] }
  | { state: 'error'; message: string }

function headersFor(provider: ApiProviderId, key: string): Record<string, string> {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      /* Anthropic refuse par défaut les appels venus d'un navigateur, pour
         éviter qu'une clé serveur ne se retrouve dans une page publique. Ici
         c'est exactement le cas prévu par l'en-tête : la clé est celle de la
         personne devant l'écran, saisie par elle, pour son propre usage. */
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }
  /* OpenRouter attribue les requêtes à une application par ces deux en-têtes.
     Le référent est l'origine de la page, pas une identité de l'utilisateur —
     et il est facultatif, donc son absence hors navigateur ne fait pas échouer
     l'appel. */
  const origin = globalThis.location?.origin
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...(origin ? { 'HTTP-Referer': origin } : {}),
    'X-Title': 'ScreenForge',
  }
}

/** Un message que l'utilisateur peut suivre, jamais un statut nu. */
function messageFor(provider: ApiProviderId, status: number): string {
  if (status === 401 || status === 403) {
    return 'Clé refusée. Vérifiez que vous l’avez recopiée entière, et qu’elle est encore active.'
  }
  if (status === 429) return 'Le fournisseur limite le débit. Réessayez dans un instant.'
  if (status === 402) {
    return provider === 'openrouter'
      ? 'Crédit OpenRouter épuisé pour cette clé.'
      : 'Le compte associé à cette clé n’a plus de crédit.'
  }
  return `Le fournisseur a répondu ${status}.`
}

async function request<T>(
  provider: ApiProviderId,
  path: string,
  key: string,
  init: RequestInit = {},
): Promise<T> {
  const base = provider === 'anthropic' ? ANTHROPIC_URL : OPENROUTER_URL
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { ...init, headers: headersFor(provider, key) })
  } catch {
    /* `fetch` rejette sans statut quand la requête n'est jamais partie :
       hors ligne, ou bloquée par une extension. Dire lequel des deux est faux
       à coup sûr, alors autant nommer les deux. */
    throw new Error(
      'Le fournisseur est injoignable. Vérifiez votre connexion, ou une extension qui bloquerait la requête.',
    )
  }
  if (!response.ok) throw new Error(messageFor(provider, response.status))
  return (await response.json()) as T
}

/**
 * Valide la clé en demandant les modèles, et non par un appel à vide.
 *
 * Le catalogue est ce dont l'étape suivante a besoin ; le demander vérifie la
 * clé en même temps, sans facturer un tour de modèle pour dire « connecté ».
 */
export async function connectApiProvider(provider: ApiProviderId, key: string): Promise<ApiStatus> {
  try {
    if (provider === 'anthropic') {
      const body = await request<{ data?: { id: string; display_name?: string }[] }>(
        'anthropic',
        '/models?limit=100',
        key,
      )
      const models = (body.data ?? []).map((entry) => ({
        id: entry.id,
        displayName: entry.display_name ?? entry.id,
      }))
      return models.length > 0
        ? { state: 'ready', models }
        : { state: 'error', message: 'Cette clé ne donne accès à aucun modèle.' }
    }

    const body = await request<{ data?: { id: string; name?: string }[] }>(
      'openrouter',
      '/models',
      key,
    )
    /* Le catalogue d'OpenRouter compte plusieurs centaines d'entrées, dont
       beaucoup ne savent pas rendre du JSON strict. Le champ de saisie les
       propose toutes en autocomplétion plutôt que dans une liste déroulante —
       trois cents lignes ne se parcourent pas, elles se filtrent. */
    const models = (body.data ?? [])
      .map((entry) => ({ id: entry.id, displayName: entry.name ?? entry.id }))
      .sort((left, right) => left.id.localeCompare(right.id))
    return models.length > 0
      ? { state: 'ready', models }
      : { state: 'error', message: 'OpenRouter n’a rendu aucun modèle pour cette clé.' }
  } catch (cause) {
    return { state: 'error', message: cause instanceof Error ? cause.message : 'Clé refusée.' }
  }
}

/**
 * Extrait l'objet JSON d'une réponse qui n'a pas promis d'en être une.
 *
 * Anthropic n'a pas de mode JSON ; OpenRouter en a un que tous ses modèles ne
 * respectent pas. Une réponse encadrée de trois mots ou d'une clôture Markdown
 * est une réponse juste, et la refuser pour cette raison reviendrait à faire
 * payer un tour à l'utilisateur pour une virgule de politesse. Le contenu, lui,
 * est revalidé plus bas comme celui de n'importe quel fournisseur.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Le fournisseur n’a pas rendu de JSON.')
  return JSON.parse(text.slice(start, end + 1))
}

interface RawScreen {
  name: string
  headline: string
  slot?: string
  screenshotIndex?: number
  evidence: string
}

interface RawPlan {
  screens?: unknown
}

function rawScreens(value: unknown, brief: CampaignBrief): RawScreen[] {
  if (!Array.isArray(value)) return []
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Le visuel ${index + 1} est hors contrat : rien n’a été repris.`)
    }
    const screen = entry as Record<string, unknown>
    const stringField = (field: 'name' | 'headline' | 'evidence', max: number) => {
      const text = screen[field]
      if (typeof text !== 'string' || !text.trim() || text.length > max) {
        throw new Error(
          `Le champ ${field} du visuel ${index + 1} est hors contrat : rien n’a été repris.`,
        )
      }
      return text.trim()
    }
    const name = stringField('name', AI_LIMITS.maxNameLength)
    const headline = stringField('headline', AI_LIMITS.maxCampaignHeadlineLength)
    const evidence = stringField('evidence', AI_LIMITS.maxEvidenceLength)
    const slot = screen.slot
    if (slot !== undefined && (typeof slot !== 'string' || slot.length > 48)) {
      throw new Error(
        `Le champ slot du visuel ${index + 1} est hors contrat : rien n’a été repris.`,
      )
    }
    const screenshotIndex = screen.screenshotIndex
    if (
      screenshotIndex !== undefined &&
      (typeof screenshotIndex !== 'number' ||
        !Number.isInteger(screenshotIndex) ||
        !brief.screenshots[screenshotIndex]?.assetId)
    ) {
      throw new Error(
        `Le visuel ${index + 1} désigne une capture indisponible : rien n’a été repris.`,
      )
    }
    return {
      name,
      headline,
      evidence,
      ...(typeof slot === 'string' ? { slot } : {}),
      ...(typeof screenshotIndex === 'number' ? { screenshotIndex } : {}),
    }
  })
}

/**
 * Ce qui est envoyé au modèle : un brief, des contraintes, aucune image.
 *
 * Le même texte que le pont envoie, au schéma près : le pont peut contraindre
 * la sortie par `outputSchema`, ces deux-là ne le peuvent pas, donc le schéma
 * voyage dans le prompt. Le doublon est assumé — le pont est un autre
 * déployable, et importer ce prompt depuis `apps/bridge` ferait entrer du code
 * serveur dans le paquet du navigateur.
 */
function planPrompt(brief: CampaignBrief, count: number): string {
  const shots = brief.screenshots
    .map(
      (shot, index) =>
        `${index}. ${shot.label}${shot.description ? ` — ${shot.description.slice(0, AI_LIMITS.maxScreenshotDescriptionLength)}` : ''}`,
    )
    .join('\n')
  return [
    'Tu es directeur artistique de la fiche App Store d’une application iOS.',
    'Tu écris les accroches des visuels de la fiche — ces images que l’utilisateur',
    'fait défiler avant de télécharger. Les trois premières décident du',
    'téléchargement : elles doivent porter le bénéfice, pas la fonctionnalité.',
    '',
    `Application : ${brief.appName}.`,
    brief.pitch ? `Ce qu’elle fait : ${brief.pitch}.` : '',
    brief.productContext
      ? `Faits produit vérifiés par l’utilisateur :\n${brief.productContext.slice(0, AI_LIMITS.maxProductContextLength)}`
      : '',
    brief.landingUrl
      ? `Provenance des faits : ${brief.landingUrl}. Ne déduis rien de cette URL et ne prétends pas l’avoir consultée.`
      : '',
    `Style visuel imposé : ${brief.direction}.`,
    `Nombre de visuels à proposer : exactement ${count}.`,
    shots
      ? `Captures décrites par l’utilisateur, dans cet ordre :\n${shots}\nCouvre-les d’abord, dans le même ordre, avec le même index dans screenshotIndex.`
      : 'Aucune capture n’est fournie : compose les visuels sur le seul brief.',
    '',
    'Écriture des accroches :',
    '— Une idée par visuel, jamais deux. Trois à six mots. En français.',
    '— Le bénéfice pour la personne, pas le nom de l’écran : « Vos dépenses,',
    '  enfin lisibles » et non « Tableau de bord ».',
    '— Aucune redite d’un visuel à l’autre, aucune reprise du nom de',
    '  l’application, aucun point final.',
    '— Ni superlatif creux ni jargon : pas de « révolutionnaire », « puissant »,',
    '  « ultime », « nouvelle génération », « propulsé par l’IA ».',
    '— Le premier visuel porte la promesse générale, les suivants une',
    '  fonctionnalité concrète chacun. Une conclusion ne peut appeler à l’essai',
    '  que si le brief contient un fait précis qui la justifie.',
    '— evidence recopie mot pour mot un court extrait du pitch, des faits produit',
    '  ou de la description de la capture qui prouve l’accroche.',
    '  Tout mot porteur de sens de headline doit reprendre le vocabulaire de',
    '  evidence. Les variantes morphologiques sont acceptées, les synonymes ne',
    '  le sont pas. headline et evidence doivent porter exactement les mêmes',
    '  marqueurs de négation, relation, quantité et temporalité. Chaque terme',
    '  porteur et chaque marqueur doivent suivre leur ordre dans l’extrait',
    '  source : ne les réordonne jamais. Si la source contient un marqueur de plus,',
    '  choisis un extrait evidence plus serré, sans le',
    '  paraphraser. N’invente jamais',
    '  une preuve et ne cite jamais l’URL comme preuve.',
    '',
    'Rends uniquement cet objet JSON, sans texte autour et sans bloc de code :',
    '{"screens":[{"name":"nom court","headline":"accroche","evidence":"extrait exact du brief","slot":"identifiant-en-minuscules","screenshotIndex":0}]}',
    'Tu écris les mots. La mise en page, les couleurs et les fonds sont composés',
    'par ScreenForge à partir du style imposé — n’en propose aucun, ils seraient',
    'ignorés sans avertissement.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function complete(
  provider: ApiProviderId,
  key: string,
  model: string,
  prompt: string,
): Promise<string> {
  if (provider === 'anthropic') {
    const body = await request<{ content?: { type?: string; text?: string }[] }>(
      'anthropic',
      '/messages',
      key,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      },
    )
    const text = (body.content ?? []).find((part) => part.type === 'text')?.text
    if (!text) throw new Error('Le modèle n’a rien répondu.')
    return text
  }

  const body = await request<{ choices?: { message?: { content?: string } }[] }>(
    'openrouter',
    '/chat/completions',
    key,
    {
      method: 'POST',
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    },
  )
  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('Le modèle n’a rien répondu.')
  return text
}

/**
 * Demande un plan au fournisseur, et n'accepte que ce que l'éditeur sait poser.
 *
 * Trois choses sont **reprises de force** au retour : l'application, la
 * direction et la palette. L'utilisateur les a choisies dans le formulaire ; un
 * modèle qui les modifie ne corrige pas une erreur, il ignore une consigne.
 * C'est la même règle que sur le pont, et elle est réécrite ici plutôt que
 * partagée parce que la partager voudrait dire faire transiter le plan par un
 * troisième format.
 */
export async function planViaApi(
  provider: ApiProviderId,
  brief: CampaignBrief,
  key: string,
  model: string,
): Promise<CampaignPlan> {
  const count = Math.max(1, Math.min(brief.screenCount, AI_LIMITS.maxScreens))
  const palette = resolvePalette(brief)
  const answer = await complete(provider, key, model, planPrompt(brief, count))
  const raw = extractJson(answer) as RawPlan

  const proposed = rawScreens(raw.screens, brief)
  if (proposed.length !== count) {
    throw new Error(
      `Le fournisseur a rendu ${proposed.length} visuel${proposed.length > 1 ? 's' : ''} au lieu de ${count} : rien n’a été repris.`,
    )
  }

  const screens: PlannedScreen[] = proposed.map((screen, index) => {
    const { name, headline, evidence } = screen
    const slot = screen.slot ?? ''
    const at = typeof screen.screenshotIndex === 'number' ? screen.screenshotIndex : index
    return {
      name,
      headline,
      evidence,
      slot: normalizeSlot(slot || name || `ecran-${index + 1}`),
      screenshotIndex: brief.screenshots[at]?.assetId ? at : undefined,
      layout: automaticArchetype(index, count, Boolean(brief.screenshots[at]?.assetId)),
    }
  })

  const plan: CampaignPlan = {
    appName: brief.appName,
    direction: brief.direction,
    palette,
    deviceModel: brief.deviceModel,
    screens,
  }
  const failure = validateGeneratedPlan(plan, brief)
  if (failure) throw new Error(`${failure} Rien n’a été repris.`)
  return plan
}
