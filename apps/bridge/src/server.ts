import { Hono } from 'hono'
import {
  AscAmbiguousError,
  AscFailedError,
  AscUnavailableError,
  ascProbeOrUndefined,
  createAscState,
  execRunner,
  runPublish,
  stepsOf,
  type AscRunner,
  type AscState,
} from './asc.ts'
import { CLAUDE_MODELS, ClaudeUnavailableError, claudeVersion, runClaudeTurn } from './claude.ts'
import { CodexClient, CodexUnavailableError, codexVersion } from './codex.ts'
import {
  BRIDGE_CAPABILITIES,
  bearer,
  createPairing,
  revoke,
  tokenVersions,
  verifyToken,
  type BridgeCapability,
  type Pairing,
} from './pairing.ts'
import {
  allowedOrigins,
  ascPublishRequestSchema,
  originAllowed,
  planRequestSchema,
  planSchema,
  translateRequestSchema,
  translationSchema,
  PLAN_OUTPUT_SCHEMA,
  PROTOCOL_VERSION,
  TRANSLATION_OUTPUT_SCHEMA,
  type BridgeBrief,
  type BridgeError,
  type BridgePlan,
  type EngineId,
  type EngineStatus,
  type Hello,
  type TranslateRequest,
} from './protocol.ts'

/**
 * Le pont, et les deux choses qu'il sait faire.
 *
 * Trois contrôles s'appliquent avant tout traitement, dans cet ordre : origine,
 * jeton **de la capacité demandée**, version de protocole. L'origine d'abord
 * parce qu'elle ne coûte rien et qu'elle est la seule que l'attaquant ne peut
 * pas recopier — un jeton lu dans une capture d'écran voyage, l'origine d'une
 * page non. La capacité ensuite : parler à un modèle et publier chez Apple sont
 * deux autorisations distinctes, et le jeton de l'une ne vaut jamais pour
 * l'autre.
 *
 * `hello` est la seule route ouverte sans jeton, et elle ne dit que ce qu'une
 * page a besoin de savoir pour proposer l'appairage : version, moteurs présents,
 * présence de `asc`, capacités. Pas de modèles, pas de chemins, pas de nom de
 * machine.
 *
 * Deux moteurs, un seul chemin : `runTurn` choisit le binaire et rend du JSON,
 * et les routes qui l'appellent ne savent pas lequel a répondu. C'est ce qui
 * garde le protocole identique quel que soit l'assistant installé — la page
 * demande un plan, pas une commande.
 */

export interface BridgeState {
  pairing: Pairing
  codex: CodexClient
  asc: AscState
  /** Injecté par les tests : aucun processus n'y est lancé. */
  ascRun: AscRunner
}

function fail(code: BridgeError['error'], detail: string): BridgeError {
  return { error: code, detail }
}

function versionMismatch(claimed: number): string {
  return `Le pont parle la version ${PROTOCOL_VERSION}, la page la ${claimed}. Mettez le pont à jour.`
}

/**
 * Un tour, quel que soit le moteur.
 *
 * Codex reçoit son `outputSchema` par le protocole ; Claude Code le reçoit dans
 * le prompt et rend son JSON extrait. Les deux rendent la même chose au même
 * endroit, ce qui laisse `planSchema` seul juge de ce qui est acceptable — un
 * moteur qui respecte un schéma n'est toujours pas un moteur vérifié.
 */
async function runTurn(
  state: BridgeState,
  engine: EngineId,
  turn: { prompt: string; outputSchema: unknown; model?: string },
): Promise<string> {
  if (engine === 'claude') return runClaudeTurn(turn)
  await state.codex.initialize()
  return state.codex.runTurn(turn)
}

export function createServer(state: BridgeState, origins = allowedOrigins()) {
  const app = new Hono()

  app.use('*', async (context, next) => {
    const origin = context.req.header('Origin')
    /* Sans `Origin`, la requête ne vient pas d'un navigateur : `curl` sur la
       boucle locale, un test, un autre outil. Le jeton reste exigé. */
    if (origin !== undefined && !originAllowed(origin, origins)) {
      return context.json(fail('forbidden-origin', `Origine refusée : ${origin}`), 403)
    }
    if (origin) {
      context.header('Access-Control-Allow-Origin', origin)
      context.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      context.header('Vary', 'Origin')
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204)
    await next()
  })

  const authorized = (capability: BridgeCapability, header: string | undefined) =>
    verifyToken(state.pairing, capability, bearer(header))

  app.get('/hello', async (context) => {
    /* Sondés en parallèle et à chaque appel : l'utilisateur qui installe son
       assistant pendant que la boîte est ouverte doit pouvoir réessayer sans
       redémarrer le pont. C'est exactement le geste que l'installation guidée
       lui propose. */
    const [codex, claude, asc] = await Promise.all([
      codexVersion(),
      claudeVersion(),
      ascProbeOrUndefined(state.asc, state.ascRun),
    ])
    const engines: EngineStatus[] = [
      ...(codex ? [{ id: 'codex' as const, version: codex }] : []),
      ...(claude ? [{ id: 'claude' as const, version: claude }] : []),
    ]
    const hello: Hello = {
      protocol: PROTOCOL_VERSION,
      bridge: '0.1.0',
      engines,
      capabilities: { vision: false, structuredOutput: true, reasoning: true },
      ascAvailable: Boolean(asc),
      ...(asc ? { ascVersion: asc.version, ascFlags: asc.flags } : {}),
      tokenVersions: tokenVersions(state.pairing),
    }
    return context.json(hello)
  })

  /**
   * Les modèles du moteur demandé.
   *
   * Codex en tient un catalogue et le rend ; Claude Code n'en rend aucun et
   * documente ses alias dans son aide. Les deux répondent donc à la même forme,
   * mais l'un l'a lue et l'autre la déclare — et la page, qui affiche ce qu'elle
   * reçoit, n'a pas à connaître la différence.
   */
  app.get('/models', async (context) => {
    if (!authorized('assistant', context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const engine = context.req.query('engine') === 'claude' ? 'claude' : 'codex'
    if (engine === 'claude') return context.json({ models: CLAUDE_MODELS })
    try {
      await state.codex.initialize()
      return context.json({ models: await state.codex.listModels() })
    } catch (error) {
      return context.json(engineFailure(error), 502)
    }
  })

  app.post('/plan', async (context) => {
    if (!authorized('assistant', context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const parsed = planRequestSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'Requête refusée par le schéma du pont.'), 400)
    }
    if (parsed.data.protocol !== PROTOCOL_VERSION) {
      return context.json(fail('protocol-mismatch', versionMismatch(parsed.data.protocol)), 409)
    }

    try {
      const answer = await runTurn(state, parsed.data.engine ?? 'codex', {
        prompt: planPrompt(parsed.data),
        outputSchema: PLAN_OUTPUT_SCHEMA,
        model: parsed.data.model,
      })
      const plan = planSchema.safeParse(JSON.parse(answer))
      if (!plan.success) {
        return context.json(
          fail('invalid-response', 'Le plan rendu par le modèle est hors schéma.'),
          502,
        )
      }
      const failure = validateGeneratedPlan(plan.data, parsed.data.brief)
      if (failure) {
        return context.json(fail('invalid-response', `${failure} Rien n’a été repris.`), 502)
      }
      return context.json({ plan: plan.data })
    } catch (error) {
      return context.json(engineFailure(error), 502)
    }
  })

  app.post('/translate', async (context) => {
    if (!authorized('assistant', context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const parsed = translateRequestSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'Requête refusée par le schéma du pont.'), 400)
    }
    if (parsed.data.protocol !== PROTOCOL_VERSION) {
      return context.json(fail('protocol-mismatch', versionMismatch(parsed.data.protocol)), 409)
    }

    try {
      const answer = await runTurn(state, parsed.data.engine ?? 'codex', {
        prompt: translatePrompt(parsed.data),
        outputSchema: TRANSLATION_OUTPUT_SCHEMA,
      })
      const translation = translationSchema.safeParse(JSON.parse(answer))
      /* Le compte doit correspondre exactement : la page rattache les textes par
         position, et une liste plus courte décalerait chaque accroche d'un
         écran. Mieux vaut ne rien rendre qu'une traduction déplacée. */
      if (!translation.success || translation.data.texts.length !== parsed.data.texts.length) {
        return context.json(
          fail('invalid-response', 'Le modèle n’a pas rendu autant de textes qu’il en a reçu.'),
          502,
        )
      }
      return context.json({ texts: translation.data.texts })
    } catch (error) {
      return context.json(engineFailure(error), 502)
    }
  })

  /**
   * Publie un lot déjà rendu, haché et vérifié.
   *
   * La page envoie les planches et l'empreinte du lot, jamais le projet vivant :
   * ce qui part chez Apple est ce qui a été figé et relu, pas ce qui se trouvait
   * sur le canevas à l'instant du clic. Le pont ne recalcule pas les images — il
   * les écrit et lance `asc`.
   *
   * Des images traversent ici, et c'est la seule route où c'est vrai : leur
   * destination est Apple, pas un modèle. C'est exactement ce que les jetons par
   * capacité rendent lisible — appairer un assistant n'autorise pas à publier,
   * et autoriser à publier ne montre rien à un modèle.
   */
  app.post('/asc/publish', async (context) => {
    if (!authorized('asc-publish', context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton de publication invalide.'), 401)
    }
    const parsed = ascPublishRequestSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'Requête refusée par le schéma du pont.'), 400)
    }
    if (parsed.data.protocol !== PROTOCOL_VERSION) {
      return context.json(fail('protocol-mismatch', versionMismatch(parsed.data.protocol)), 409)
    }

    try {
      return context.json(await runPublish(state.asc, parsed.data, state.ascRun))
    } catch (error) {
      /* Les étapes franchies partent avec l'échec : « où » est l'information
         qui distingue un binaire absent d'un lot refusé par Apple. */
      const steps = stepsOf(error)
      if (error instanceof AscUnavailableError) {
        return context.json({ ...fail('asc-unavailable', error.message), steps }, 502)
      }
      /* Le sort du téléversement est inconnu : le pont ne rejoue rien de
         lui-même, parce qu'un second envoi doublerait les captures chez Apple.
         C'est un 409, pas un 502 : rien ne dit que ça a échoué. */
      if (error instanceof AscAmbiguousError) {
        return context.json({ ...fail('ambiguous-timeout', error.message), steps }, 409)
      }
      const detail = error instanceof AscFailedError ? error.message : 'Publication interrompue.'
      return context.json({ ...fail('asc-failed', detail), steps }, 502)
    }
  })

  /** Révoquer une capacité : son jeton meurt à l'instant, l'autre survit. */
  app.post('/pair/revoke', async (context) => {
    const body = (await context.req.json().catch(() => ({}))) as { capability?: string }
    const capability = BRIDGE_CAPABILITIES.find((known) => known === body.capability) ?? 'assistant'
    if (!authorized(capability, context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    state.pairing = revoke(state.pairing, capability)
    console.log(
      `\nNouveau jeton « ${capability} » (version ${state.pairing[capability].version}) :\n${state.pairing[capability].token}\n`,
    )
    return context.json({ capability, tokenVersion: state.pairing[capability].version })
  })

  return app
}

function engineFailure(error: unknown): BridgeError {
  if (error instanceof CodexUnavailableError) {
    return fail(
      'engine-unavailable',
      'Codex n’a pas démarré. Vérifiez que la commande « codex » est installée et connectée.',
    )
  }
  if (error instanceof ClaudeUnavailableError) {
    /* Le message porte la sortie d'erreur du binaire quand il en a produit une :
       « session expirée » et « modèle inconnu » appellent deux gestes
       différents, qu'un texte générique effacerait tous les deux. */
    return fail('engine-unavailable', `Claude Code n’a pas répondu. ${error.message}`.trim())
  }
  return fail(
    'invalid-response',
    error instanceof Error ? error.message : 'Échec de la génération.',
  )
}

const GENERIC_HEADLINES = [
  'essayez et sentez la difference',
  'a votre rythme a votre image',
  'retrouvez tout en un instant',
  'partagez avec ceux qui comptent',
  'rien d important ne vous echappe',
  'votre quotidien enfin plus leger',
] as const

const CLAIM_STOPWORDS = new Set([
  'afin',
  'alors',
  'cette',
  'comme',
  'dans',
  'elle',
  'elles',
  'encore',
  'enfin',
  'etre',
  'faire',
  'leur',
  'leurs',
  'mais',
  'meme',
  'notre',
  'nous',
  'pour',
  'sont',
  'votre',
  'vous',
])

const SEMANTIC_MARKERS = new Set([
  'pas',
  'non',
  'ni',
  'avec',
  'sans',
  'plus',
  'moins',
  'rien',
  'seulement',
  'chaque',
  'tout',
  'tous',
  'toute',
  'toutes',
  'avant',
  'apres',
  'depuis',
  'entre',
  'quand',
])

function normalizedCopy(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function significantTerms(value: string): string[] {
  return normalizedCopy(value)
    .split(' ')
    .filter(
      (term) => SEMANTIC_MARKERS.has(term) || (term.length >= 4 && !CLAIM_STOPWORDS.has(term)),
    )
}

function termStem(term: string): string {
  return term.length >= 5 ? term.slice(0, 5) : term
}

function semanticMarkers(value: string): Set<string> {
  return new Set(
    normalizedCopy(value)
      .split(' ')
      .filter((term) => SEMANTIC_MARKERS.has(term)),
  )
}

function haveSameSemanticMarkers(headline: string, evidence: string): boolean {
  const claimMarkers = semanticMarkers(headline)
  const evidenceMarkers = semanticMarkers(evidence)
  return (
    claimMarkers.size === evidenceMarkers.size &&
    [...claimMarkers].every((marker) => evidenceMarkers.has(marker))
  )
}

function isOrderedSubsequence(claim: string[], evidence: string[]): boolean {
  let claimIndex = 0
  for (const evidenceStem of evidence) {
    if (evidenceStem === claim[claimIndex]) claimIndex += 1
  }
  return claimIndex === claim.length
}

function claimMatchesEvidence(headline: string, evidence: string): boolean {
  const claimStems = significantTerms(headline).map(termStem)
  const evidenceStems = significantTerms(evidence).map(termStem)
  return (
    claimStems.length > 0 &&
    isOrderedSubsequence(claimStems, evidenceStems) &&
    haveSameSemanticMarkers(headline, evidence)
  )
}

function validateGeneratedPlan(plan: BridgePlan, brief: BridgeBrief): string | null {
  const expected = brief.screenCount ?? Math.max(1, brief.screenshots.length)
  if (plan.screens.length !== expected) {
    return `Le modèle a rendu ${plan.screens.length} visuel${plan.screens.length > 1 ? 's' : ''} au lieu de ${expected}.`
  }
  const seen = new Set<string>()
  for (const [index, screen] of plan.screens.entries()) {
    const normalized = normalizedCopy(screen.headline)
    const wordCount = screen.headline.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    if (wordCount < 3 || wordCount > 7) {
      return `L’accroche ${index + 1} doit contenir entre 3 et 7 mots.`
    }
    if (seen.has(normalized)) return `L’accroche ${index + 1} répète une autre proposition.`
    seen.add(normalized)
    if (GENERIC_HEADLINES.some((generic) => normalized.includes(generic))) {
      return `L’accroche ${index + 1} est trop générique pour ce produit.`
    }
    const shot =
      screen.screenshotIndex === undefined ? undefined : brief.screenshots[screen.screenshotIndex]
    if (screen.screenshotIndex !== undefined && !shot?.hasAsset) {
      return `L’accroche ${index + 1} désigne une capture indisponible.`
    }
    const evidence = screen.evidence.trim()
    const normalizedEvidence = normalizedCopy(evidence)
    const sources = [brief.pitch, brief.productContext ?? '', shot?.description ?? '']
    if (
      !normalizedEvidence ||
      !claimMatchesEvidence(screen.headline, evidence) ||
      !sources.some((source) => normalizedCopy(source).includes(normalizedEvidence))
    ) {
      return `L’accroche ${index + 1} n’est justifiée par aucun fait du brief.`
    }
  }
  return null
}

/**
 * Ce qui est envoyé au modèle : un brief, des contraintes, aucune image.
 *
 * Le prompt dit explicitement que la réponse sera exécutée par un constructeur
 * déterministe, parce que c'est vrai et que cela évite au modèle de proposer ce
 * que les outils n'acceptent pas.
 */
function planPrompt(request: { brief: BridgeBrief; deviceModel: string }): string {
  const { brief } = request
  const count = brief.screenCount ?? Math.max(1, brief.screenshots.length)
  const shots = brief.screenshots
    .map(
      (shot, index) =>
        `${index}. ${shot.label}${shot.hasAsset ? ' (capture fournie)' : ''}${shot.description ? ` — ${shot.description}` : ''}`,
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
      ? `Faits produit vérifiés par l’utilisateur :\n${brief.productContext}`
      : '',
    brief.landingUrl
      ? `Provenance des faits : ${brief.landingUrl}. Ne déduis rien de cette URL et ne prétends pas l’avoir consultée.`
      : '',
    `Style visuel imposé : ${brief.direction}.`,
    `Appareil imposé : ${request.deviceModel}.`,
    `Nombre de visuels à proposer : exactement ${count}.`,
    shots
      ? `Captures décrites par l’utilisateur, dans cet ordre :\n${shots}\nCouvre-les d’abord, dans le même ordre, avec le même index dans screenshotIndex. Les visuels au-delà de cette liste n’ont pas de capture : laisse screenshotIndex absent.`
      : 'Aucune capture n’est fournie : compose les visuels sur le seul brief, sans screenshotIndex.',
    '',
    'Écriture des accroches :',
    '— Une idée par visuel, jamais deux. Trois à six mots. En français.',
    '— Le bénéfice pour la personne, pas le nom de l’écran : « Vos dépenses,',
    '  enfin lisibles » et non « Tableau de bord ».',
    '— Aucune redite d’un visuel à l’autre, aucune reprise du nom de',
    '  l’application, aucun point final, aucune majuscule décorative.',
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
    'name est un nom d’écran court, pour la barre de l’éditeur.',
    'slot est un identifiant en minuscules, chiffres et traits d’union.',
    '',
    'Rends uniquement le JSON du plan, conforme au schéma fourni.',
    'Tu écris les mots, et rien d’autre. La composition de chaque visuel — mise en',
    'page, fond, couleurs, cadrage de l’appareil — est décidée par ScreenForge à',
    'partir du style imposé et du rang du visuel. N’en propose aucune : le schéma',
    'ne la reçoit pas, et elle serait ignorée sans avertissement.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Ce qui est demandé au modèle : traduire, pas réécrire.
 *
 * L'ordre et le nombre sont exigés parce que la page rattache par position, et
 * la brièveté parce qu'une accroche traduite qui double de longueur déborde de
 * la boîte où elle est posée — la revue le signalera, mais autant ne pas le
 * provoquer.
 */
function translatePrompt(request: TranslateRequest): string {
  return [
    `Traduis en ${request.target.name} (${request.target.code}) les accroches de captures App Store ci-dessous.`,
    'Rends exactement autant de textes que tu en reçois, dans le même ordre.',
    'Garde la longueur proche de l’original : ces textes sont posés dans des boîtes fixes.',
    'Pas de guillemets ajoutés, pas de ponctuation finale ajoutée, aucune explication.',
    '',
    ...request.texts.map((text, index) => `${index + 1}. ${text}`),
  ].join('\n')
}

export function createState(): BridgeState {
  return {
    pairing: createPairing(),
    codex: new CodexClient(),
    asc: createAscState(),
    ascRun: execRunner,
  }
}
