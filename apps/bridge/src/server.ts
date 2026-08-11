import { Hono } from 'hono'
import { CodexClient, CodexUnavailableError, codexVersion } from './codex.ts'
import { bearer, createPairing, revoke, verifyToken, type Pairing } from './pairing.ts'
import {
  allowedOrigins,
  originAllowed,
  planRequestSchema,
  planSchema,
  PLAN_OUTPUT_SCHEMA,
  PROTOCOL_VERSION,
  type BridgeError,
  type Hello,
} from './protocol.ts'

/**
 * Le pont, en quatre routes.
 *
 * Trois contrôles s'appliquent avant tout traitement, dans cet ordre : origine,
 * version de protocole, jeton. L'origine d'abord parce qu'elle ne coûte rien et
 * qu'elle est la seule que l'attaquant ne peut pas recopier — un jeton lu dans
 * une capture d'écran voyage, l'origine d'une page non.
 *
 * `hello` est la seule route ouverte sans jeton, et elle ne dit que ce qu'une
 * page a besoin de savoir pour proposer l'appairage : version, présence de
 * Codex, capacités. Pas de modèles, pas de chemins, pas de nom de machine.
 */

export interface BridgeState {
  pairing: Pairing
  codex: CodexClient
}

function fail(code: BridgeError['error'], detail: string): BridgeError {
  return { error: code, detail }
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

  const authorized = (header: string | undefined) => verifyToken(state.pairing, bearer(header))

  app.get('/hello', async (context) => {
    const version = await codexVersion()
    const hello: Hello = {
      protocol: PROTOCOL_VERSION,
      bridge: '0.1.0',
      codexAvailable: Boolean(version),
      ...(version ? { codexVersion: version } : {}),
      capabilities: { vision: false, structuredOutput: true, reasoning: true },
      tokenVersion: state.pairing.version,
    }
    return context.json(hello)
  })

  app.get('/models', async (context) => {
    if (!authorized(context.req.header('Authorization'))) {
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
    if (!authorized(context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    const parsed = planRequestSchema.safeParse(await context.req.json().catch(() => null))
    if (!parsed.success) {
      return context.json(fail('invalid-request', 'Requête refusée par le schéma du pont.'), 400)
    }
    if (parsed.data.protocol !== PROTOCOL_VERSION) {
      return context.json(
        fail(
          'protocol-mismatch',
          `Le pont parle la version ${PROTOCOL_VERSION}, la page la ${parsed.data.protocol}. Mettez le pont à jour.`,
        ),
        409,
      )
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

  /** Révoquer sur demande : le jeton d'avant meurt à l'instant. */
  app.post('/pair/revoke', (context) => {
    if (!authorized(context.req.header('Authorization'))) {
      return context.json(fail('unauthorized', 'Jeton d’appairage invalide.'), 401)
    }
    state.pairing = revoke(state.pairing)
    console.log(
      `\nNouveau jeton d’appairage (version ${state.pairing.version}) :\n${state.pairing.token}\n`,
    )
    return context.json({ tokenVersion: state.pairing.version })
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

export function createState(): BridgeState {
  return { pairing: createPairing(), codex: new CodexClient() }
}
