import { describe, expect, it, vi } from 'vitest'
import type { CodexClient } from './codex.ts'

/**
 * Ce que le pont doit refuser.
 *
 * Un pont local est un processus qui écoute sur la machine de l'utilisateur et
 * qui lance un binaire. Les tests qui comptent ne sont donc pas ceux du chemin
 * heureux mais ceux des trois barrières : l'origine, le jeton, le schéma. Une
 * seule qui cède et la page ouverte dans l'onglet d'à côté commande Codex.
 *
 * Aucun identifiant réel ici : le jeton est celui que le pont tire lui-même en
 * mémoire, et Codex est remplacé par un double qui ne lance aucun processus.
 */

vi.mock('./codex.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./codex.ts')>()),
  codexVersion: async () => 'codex-cli 0.0.0-test',
}))

const { createServer } = await import('./server.ts')
const { bearer, createPairing, mintToken, revoke, verifyToken } = await import('./pairing.ts')
const { allowedOrigins, briefSchema, planSchema, DEFAULT_ORIGINS, PROTOCOL_VERSION } =
  await import('./protocol.ts')
const { CodexUnavailableError } = await import('./codex.ts')

const ORIGIN = DEFAULT_ORIGINS[0]

const PLAN = {
  appName: 'Cadence',
  direction: 'sobre',
  deviceModel: 'iphone-17-pro',
  screens: [
    {
      name: 'Accueil',
      headline: 'Le rythme de vos journées',
      background: { type: 'solid', color: '#f2f3f5' },
      screenshotIndex: 0,
    },
  ],
}

const BRIEF = {
  appName: 'Cadence',
  pitch: 'Le rythme de vos journées',
  direction: 'sobre',
  screenshots: [{ label: 'Accueil', hasAsset: true }],
}

function fakeCodex(answer: () => Promise<string>) {
  return {
    initialize: async () => undefined,
    listModels: async () => [
      { id: 'modele-test', displayName: 'Modèle test', reasoningEfforts: [] },
    ],
    runTurn: answer,
    dispose: () => undefined,
  } as unknown as CodexClient
}

function harness(answer: () => Promise<string> = async () => JSON.stringify(PLAN)) {
  const state = { pairing: createPairing(), codex: fakeCodex(answer) }
  const app = createServer(state, DEFAULT_ORIGINS)
  /** `origin: null` retire l'en-tête : c'est `curl`, pas un navigateur. */
  const call = (
    path: string,
    init: RequestInit & { token?: string | null; origin?: string | null } = {},
  ) => {
    const { token = state.pairing.token, origin = ORIGIN, ...rest } = init
    return app.request(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { Origin: origin } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }
  return { state, call }
}

const planBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    protocol: PROTOCOL_VERSION,
    brief: BRIEF,
    deviceModel: 'iphone-17-pro',
    ...overrides,
  })

describe('appairage', () => {
  it('tire un jeton différent à chaque fois, assez long pour ne pas se deviner', () => {
    const tokens = new Set(Array.from({ length: 32 }, mintToken))
    expect(tokens.size).toBe(32)
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43)
  })

  it('révoque : la version monte et le jeton d’avant ne vaut plus', () => {
    const first = createPairing()
    const second = revoke(first)
    expect(second.version).toBe(first.version + 1)
    expect(verifyToken(second, first.token)).toBe(false)
    expect(verifyToken(second, second.token)).toBe(true)
  })

  it('refuse un jeton absent, tronqué ou allongé', () => {
    const pairing = createPairing()
    expect(verifyToken(pairing, undefined)).toBe(false)
    expect(verifyToken(pairing, '')).toBe(false)
    expect(verifyToken(pairing, pairing.token.slice(0, -1))).toBe(false)
    expect(verifyToken(pairing, `${pairing.token}x`)).toBe(false)
  })

  it('ne lit un jeton que derrière le schéma Bearer', () => {
    expect(bearer('Bearer abc')).toBe('abc')
    expect(bearer('bearer abc')).toBeUndefined()
    expect(bearer('Basic abc')).toBeUndefined()
    expect(bearer('Bearer')).toBeUndefined()
    expect(bearer(undefined)).toBeUndefined()
  })

  it('révoque à chaud : le jeton présenté meurt sur la réponse même', async () => {
    const { state, call } = harness()
    const before = state.pairing.token
    const response = await call('/pair/revoke', { method: 'POST' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tokenVersion: 2 })
    expect((await call('/models', { token: before })).status).toBe(401)
    expect((await call('/models')).status).toBe(200)
  })
})

describe('origine', () => {
  it('refuse une page servie ailleurs, jeton valide ou non', async () => {
    const { call } = harness()
    const response = await call('/hello', { origin: 'https://voisin.example' })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'forbidden-origin' })
  })

  it('n’admet jamais un joker venu de l’environnement', () => {
    expect(allowedOrigins('*')).toEqual(DEFAULT_ORIGINS)
    expect(allowedOrigins('http://localhost:1234, *')).toEqual([
      ...DEFAULT_ORIGINS,
      'http://localhost:1234',
    ])
    expect(allowedOrigins(undefined)).toEqual(DEFAULT_ORIGINS)
  })

  it('laisse passer un client sans origine, qui doit toujours son jeton', async () => {
    const { call } = harness()
    expect((await call('/models', { origin: null })).status).toBe(200)
    expect((await call('/models', { origin: null, token: null })).status).toBe(401)
  })
})

describe('capacités', () => {
  it('annonce sans jeton ce qu’il faut pour s’appairer, et rien d’autre', async () => {
    const { state, call } = harness()
    const response = await call('/hello', { token: null })
    expect(response.status).toBe(200)
    const hello = await response.json()
    expect(hello).toEqual({
      protocol: PROTOCOL_VERSION,
      bridge: '0.1.0',
      codexAvailable: true,
      codexVersion: 'codex-cli 0.0.0-test',
      capabilities: { vision: false, structuredOutput: true, reasoning: true },
      tokenVersion: 1,
    })
    expect(JSON.stringify(hello)).not.toContain(state.pairing.token)
  })

  it('garde les modèles derrière le jeton', async () => {
    const { call } = harness()
    expect((await call('/models', { token: null })).status).toBe(401)
    expect(await (await call('/models')).json()).toMatchObject({
      models: [{ id: 'modele-test' }],
    })
  })
})

describe('protocole', () => {
  it('rend un plan quand le modèle respecte le schéma', async () => {
    const { call } = harness()
    const response = await call('/plan', { method: 'POST', body: planBody() })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ plan: PLAN })
  })

  it('refuse une requête hors schéma avant d’allumer Codex', async () => {
    const spawned = vi.fn(async () => JSON.stringify(PLAN))
    const { call } = harness(spawned)
    const response = await call('/plan', {
      method: 'POST',
      body: planBody({ brief: { ...BRIEF, direction: 'fluo' } }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid-request' })
    expect(spawned).not.toHaveBeenCalled()
  })

  it('dit la version au lieu de deviner quand la page est en avance', async () => {
    const { call } = harness()
    const response = await call('/plan', { method: 'POST', body: planBody({ protocol: 99 }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'protocol-mismatch' })
  })

  it('revalide la réponse du modèle : un plan hors schéma ne passe pas', async () => {
    const { call } = harness(async () => JSON.stringify({ ...PLAN, screens: [] }))
    const response = await call('/plan', { method: 'POST', body: planBody() })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'invalid-response' })
  })

  it('dit que Codex manque plutôt que d’échouer en silence', async () => {
    const { call } = harness(async () => {
      throw new CodexUnavailableError('codex introuvable')
    })
    const response = await call('/plan', { method: 'POST', body: planBody() })
    expect(response.status).toBe(502)
    const error = (await response.json()) as { error: string; detail: string }
    expect(error).toMatchObject({ error: 'codex-unavailable' })
    expect(error.detail).toMatch(/codex/i)
  })

  it('traduit par position, et refuse un lot dont le compte a changé', async () => {
    const target = { code: 'de', name: 'Allemand', script: 'latin' }
    const body = (texts: string[]) => JSON.stringify({ protocol: PROTOCOL_VERSION, target, texts })

    const good = harness(async () => JSON.stringify({ texts: ['Rhythmus', 'Jeder Euro'] }))
    const answer = await good.call('/translate', {
      method: 'POST',
      body: body(['Le rythme', 'Chaque euro']),
    })
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ texts: ['Rhythmus', 'Jeder Euro'] })

    /* Un texte de moins décalerait chaque accroche d'un écran : la page
       rattache par position, donc mieux vaut ne rien rendre. */
    const short = harness(async () => JSON.stringify({ texts: ['Rhythmus'] }))
    const refused = await short.call('/translate', {
      method: 'POST',
      body: body(['Le rythme', 'Chaque euro']),
    })
    expect(refused.status).toBe(502)
    expect(await refused.json()).toMatchObject({ error: 'invalid-response' })
  })

  it('ne traduit ni sans jeton, ni un lot vide, ni hors version', async () => {
    const target = { code: 'de', name: 'Allemand', script: 'latin' }
    const { call } = harness(async () => JSON.stringify({ texts: ['Rhythmus'] }))
    const send = (payload: unknown, token?: string | null) =>
      call('/translate', {
        method: 'POST',
        body: JSON.stringify(payload),
        ...(token !== undefined ? { token } : {}),
      })

    expect((await send({ protocol: PROTOCOL_VERSION, target, texts: ['x'] }, null)).status).toBe(
      401,
    )
    expect((await send({ protocol: PROTOCOL_VERSION, target, texts: [] })).status).toBe(400)
    expect((await send({ protocol: 99, target, texts: ['x'] })).status).toBe(409)
  })

  it('ne laisse traverser aucune image, même offerte', () => {
    const parsed = briefSchema.parse({
      ...BRIEF,
      screenshots: [{ label: 'Accueil', hasAsset: true, dataUrl: 'data:image/png;base64,AAAA' }],
    })
    expect(parsed.screenshots[0]).toEqual({ label: 'Accueil', hasAsset: true })
    expect(JSON.stringify(parsed)).not.toContain('data:')
  })

  it('borne le plan à ce que l’éditeur sait poser', () => {
    const many = { ...PLAN, screens: Array.from({ length: 11 }, () => PLAN.screens[0]) }
    expect(planSchema.safeParse(many).success).toBe(false)
    expect(
      planSchema.safeParse({
        ...PLAN,
        screens: [{ ...PLAN.screens[0], background: { type: 'solid', color: 'rouge' } }],
      }).success,
    ).toBe(false)
  })
})
