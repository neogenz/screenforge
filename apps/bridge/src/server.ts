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
  type BridgeError,
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
 * page a besoin de savoir pour proposer l'appairage : version, présence de
 * `codex` et de `asc`, capacités. Pas de modèles, pas de chemins, pas de nom de
 * machine.
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
    const [version, asc] = await Promise.all([
      codexVersion(),
      ascProbeOrUndefined(state.asc, state.ascRun),
    ])
    const hello: Hello = {
      protocol: PROTOCOL_VERSION,
      bridge: '0.1.0',
      codexAvailable: Boolean(version),
      ...(version ? { codexVersion: version } : {}),
      capabilities: { vision: false, structuredOutput: true, reasoning: true },
      ascAvailable: Boolean(asc),
      ...(asc ? { ascVersion: asc.version, ascFlags: asc.flags } : {}),
      tokenVersions: tokenVersions(state.pairing),
    }
    return context.json(hello)
  })

  app.get('/models', async (context) => {
    if (!authorized('codex', context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    try {
      await state.codex.initialize()
      return context.json({ models: await state.codex.listModels() })
    } catch (error) {
      return context.json(codexFailure(error), 502)
    }
  })

  app.post('/plan', async (context) => {
    if (!authorized('codex', context.req.header('Authorization'))) {
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
      await state.codex.initialize()
      const answer = await state.codex.runTurn({
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
      return context.json({ plan: plan.data })
    } catch (error) {
      return context.json(codexFailure(error), 502)
    }
  })

  app.post('/translate', async (context) => {
    if (!authorized('codex', context.req.header('Authorization'))) {
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
      await state.codex.initialize()
      const answer = await state.codex.runTurn({
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
      return context.json(codexFailure(error), 502)
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
    const capability = BRIDGE_CAPABILITIES.find((known) => known === body.capability) ?? 'codex'
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

function codexFailure(error: unknown): BridgeError {
  if (error instanceof CodexUnavailableError) {
    return fail(
      'codex-unavailable',
      'Codex n’a pas démarré. Vérifiez que la commande `codex` est installée et connectée.',
    )
  }
  return fail(
    'invalid-response',
    error instanceof Error ? error.message : 'Échec de la génération.',
  )
}

/**
 * Ce qui est envoyé au modèle : un brief, des contraintes, aucune image.
 *
 * Le prompt dit explicitement que la réponse sera exécutée par un constructeur
 * déterministe, parce que c'est vrai et que cela évite au modèle de proposer ce
 * que les outils n'acceptent pas.
 */
function planPrompt(request: {
  brief: import('./protocol.ts').BridgeBrief
  deviceModel: string
}): string {
  const shots = request.brief.screenshots
    .map((shot, index) => `${index}. ${shot.label}${shot.hasAsset ? ' (capture fournie)' : ''}`)
    .join('\n')
  return [
    'Tu composes un plan de captures App Store pour une application iOS.',
    `Application : ${request.brief.appName}.`,
    request.brief.pitch ? `Ce qu’elle fait : ${request.brief.pitch}.` : '',
    `Direction visuelle imposée : ${request.brief.direction}.`,
    `Modèle d’appareil imposé : ${request.deviceModel}.`,
    shots
      ? `Écrans à couvrir, dans cet ordre :\n${shots}`
      : 'Aucune capture fournie : propose une seule planche.',
    '',
    'Rends uniquement le JSON du plan, conforme au schéma fourni.',
    'Une planche par écran listé, dans le même ordre, avec le même index dans screenshotIndex.',
    'headline est une accroche courte, en français, sans point final.',
    'slot est un identifiant en minuscules, chiffres et traits d’union.',
    'Ce plan sera exécuté par un constructeur déterministe : il ne peut poser que',
    'des écrans, des fonds unis, des textes et des cadres d’appareil.',
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
