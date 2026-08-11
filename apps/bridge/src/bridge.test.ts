import { describe, expect, it, vi } from 'vitest'
import type { AscRunner } from './asc.ts'
import type { CodexClient } from './codex.ts'
import type { BridgeCapability } from './pairing.ts'

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
const {
  allowedOrigins,
  ascPublishRequestSchema,
  briefSchema,
  planSchema,
  DEFAULT_ORIGINS,
  PROTOCOL_VERSION,
} = await import('./protocol.ts')
const { CodexUnavailableError } = await import('./codex.ts')
const { createAscState, idempotenceKey, redact, uploadArgs } = await import('./asc.ts')

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

/**
 * Un `asc` de papier : il note ce qu'on lui demande et ne lance rien.
 *
 * Les tests qui comptent ici portent sur les arguments construits et sur ce que
 * le pont refuse — lancer le vrai binaire téléverserait chez Apple.
 */
function fakeAsc(
  overrides: {
    upload?: () => Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }>
    version?: string | null
  } = {},
) {
  const calls: string[][] = []
  const run: AscRunner = async (args) => {
    calls.push(args)
    if (args[0] === '--version') {
      return overrides.version === null
        ? { code: 1, stdout: '', stderr: 'command not found', timedOut: false }
        : { code: 0, stdout: overrides.version ?? '0.45.4', stderr: '', timedOut: false }
    }
    if (args.includes('--help')) {
      return {
        code: 0,
        stdout: 'FLAGS\n  --replace\n  --dry-run\n  --skip-existing\n  --output',
        stderr: '',
        timedOut: false,
      }
    }
    return (
      overrides.upload?.() ??
      Promise.resolve({ code: 0, stdout: '{"uploaded":1}', stderr: '', timedOut: false })
    )
  }
  return { calls, run }
}

function harness(
  answer: () => Promise<string> = async () => JSON.stringify(PLAN),
  asc = fakeAsc(),
) {
  const state = {
    pairing: createPairing(),
    codex: fakeCodex(answer),
    asc: createAscState(),
    ascRun: asc.run,
  }
  const app = createServer(state, DEFAULT_ORIGINS)
  /** `origin: null` retire l'en-tête : c'est `curl`, pas un navigateur. */
  const call = (
    path: string,
    init: RequestInit & {
      token?: string | null
      origin?: string | null
      capability?: BridgeCapability
    } = {},
  ) => {
    const { capability = 'codex', origin = ORIGIN, ...rest } = init
    const { token = state.pairing[capability].token } = init
    delete (rest as { capability?: unknown }).capability
    delete (rest as { token?: unknown }).token
    return app.request(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { Origin: origin } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }
  return { state, call, asc }
}

const PUBLISH = {
  releaseId: 'rel-1',
  bundleHash: 'a'.repeat(64),
  target: { versionLocalization: 'LOC-1', deviceType: 'APP_IPHONE_69' },
  files: [{ name: '01_accueil.png', base64: Buffer.from('planche').toString('base64') }],
}

const publishBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ protocol: PROTOCOL_VERSION, ...PUBLISH, ...overrides })

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

  it('révoque une capacité sans toucher à l’autre', () => {
    const first = createPairing()
    const second = revoke(first, 'codex')
    expect(second.codex.version).toBe(first.codex.version + 1)
    expect(verifyToken(second, 'codex', first.codex.token)).toBe(false)
    expect(verifyToken(second, 'codex', second.codex.token)).toBe(true)
    // Publier n'a pas été révoqué : son jeton et sa version n'ont pas bougé.
    expect(second['asc-publish']).toEqual(first['asc-publish'])
  })

  it('ne fait jamais valoir le jeton d’une capacité pour l’autre', () => {
    const pairing = createPairing()
    expect(verifyToken(pairing, 'codex', pairing['asc-publish'].token)).toBe(false)
    expect(verifyToken(pairing, 'asc-publish', pairing.codex.token)).toBe(false)
    expect(pairing.codex.token).not.toBe(pairing['asc-publish'].token)
  })

  it('refuse un jeton absent, tronqué ou allongé', () => {
    const pairing = createPairing()
    expect(verifyToken(pairing, 'codex', undefined)).toBe(false)
    expect(verifyToken(pairing, 'codex', '')).toBe(false)
    expect(verifyToken(pairing, 'codex', pairing.codex.token.slice(0, -1))).toBe(false)
    expect(verifyToken(pairing, 'codex', `${pairing.codex.token}x`)).toBe(false)
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
    const before = state.pairing.codex.token
    const publishing = state.pairing['asc-publish'].token
    const response = await call('/pair/revoke', {
      method: 'POST',
      body: JSON.stringify({ capability: 'codex' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ capability: 'codex', tokenVersion: 2 })
    expect((await call('/models', { token: before })).status).toBe(401)
    expect((await call('/models')).status).toBe(200)
    // La publication n'a pas été révoquée avec elle.
    expect(state.pairing['asc-publish'].token).toBe(publishing)
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
      ascAvailable: true,
      ascVersion: '0.45.4',
      ascFlags: ['--replace', '--dry-run', '--skip-existing', '--output'],
      tokenVersions: { codex: 1, 'asc-publish': 1 },
    })
    expect(JSON.stringify(hello)).not.toContain(state.pairing.codex.token)
    expect(JSON.stringify(hello)).not.toContain(state.pairing['asc-publish'].token)
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

  it('n’a aucun champ pour un identifiant Apple, offert ou non', () => {
    const parsed = ascPublishRequestSchema.parse({
      protocol: PROTOCOL_VERSION,
      ...PUBLISH,
      apiKeyId: 'ABCD1234',
      issuerId: '69a6de70-0000-0000-0000-000000000000',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
      p8Path: '/Users/quelquun/AuthKey_ABCD1234.p8',
    })
    const body = JSON.stringify(parsed)
    expect(body).not.toContain('ABCD1234')
    expect(body).not.toContain('PRIVATE KEY')
    expect(body).not.toContain('.p8')
  })

  it('refuse un nom de fichier qui sort du dossier', () => {
    for (const name of ['../evil.png', 'a/b.png', 'Accueil.PNG', 'planche.sh', '.png']) {
      expect(
        ascPublishRequestSchema.safeParse({
          protocol: PROTOCOL_VERSION,
          ...PUBLISH,
          files: [{ name, base64: 'AAAA' }],
        }).success,
      ).toBe(false)
    }
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

describe('publication', () => {
  it('n’accepte que le jeton de sa capacité', async () => {
    const { state, call } = harness()
    expect((await call('/asc/publish', { method: 'POST', body: publishBody() })).status).toBe(401)
    expect(
      (
        await call('/asc/publish', {
          method: 'POST',
          body: publishBody(),
          token: state.pairing.codex.token,
        })
      ).status,
    ).toBe(401)
    expect(
      (
        await call('/asc/publish', {
          method: 'POST',
          body: publishBody(),
          capability: 'asc-publish',
        })
      ).status,
    ).toBe(200)
  })

  it('construit la commande par tableau, sans --replace tant qu’on ne l’a pas demandé', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    const response = await call('/asc/publish', {
      method: 'POST',
      body: publishBody(),
      capability: 'asc-publish',
    })
    const result = (await response.json()) as { command: string[]; replaceExisting: boolean }
    expect(result.replaceExisting).toBe(false)
    expect(result.command).not.toContain('--replace')
    const upload = asc.calls.at(-1)!
    expect(upload).not.toContain('--replace')
    expect(upload.slice(0, 6)).toEqual([
      'screenshots',
      'upload',
      '--version-localization',
      'LOC-1',
      '--device-type',
      'APP_IPHONE_69',
    ])
    // Aucun argument n'est une chaîne composée : chacun est un élément à part.
    expect(upload.every((argument) => !argument.includes(' '))).toBe(true)
  })

  it('n’ajoute --replace que sur demande explicite', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    await call('/asc/publish', {
      method: 'POST',
      body: publishBody({ replaceExisting: true }),
      capability: 'asc-publish',
    })
    expect(asc.calls.at(-1)).toContain('--replace')
    expect(
      uploadArgs(PUBLISH.target, { path: '/tmp/x', replaceExisting: false, dryRun: false }),
    ).not.toContain('--replace')
  })

  it('ne republie pas le même lot vers la même destination', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    // `dryRun` explicitement faux : un essai à blanc n'entre jamais dans la
    // mémoire, donc il ne pourrait rien y avoir à retrouver.
    const send = () =>
      call('/asc/publish', {
        method: 'POST',
        body: publishBody({ dryRun: false }),
        capability: 'asc-publish',
      })

    const first = (await (await send()).json()) as { idempotent: boolean }
    const uploads = asc.calls.filter(
      (args) => args[1] === 'upload' && !args.includes('--help'),
    ).length
    const second = (await (await send()).json()) as { idempotent: boolean }

    expect(first.idempotent).toBe(false)
    expect(second.idempotent).toBe(true)
    expect(
      asc.calls.filter((args) => args[1] === 'upload' && !args.includes('--help')).length,
    ).toBe(uploads)
    // Un lot différent vers la même destination repart, lui.
    await call('/asc/publish', {
      method: 'POST',
      body: publishBody({ bundleHash: 'b'.repeat(64), dryRun: false }),
      capability: 'asc-publish',
    })
    expect(
      asc.calls.filter((args) => args[1] === 'upload' && !args.includes('--help')).length,
    ).toBe(uploads + 1)
    expect(idempotenceKey({ ...PUBLISH, replaceExisting: false, dryRun: false })).toContain('rel-1')
  })

  it('ne prend pas un remplacement pour le doublon d’un ajout', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    const uploads = () =>
      asc.calls.filter((args) => args[1] === 'upload' && !args.includes('--help')).length

    await call('/asc/publish', {
      method: 'POST',
      body: publishBody({ dryRun: false }),
      capability: 'asc-publish',
    })
    const après = uploads()

    /* Même lot, même destination, mais la case « supprimer les captures déjà en
       ligne » a changé : ce n'est pas la même opération. La clé les confondait,
       donc la demande destructrice était avalée par le cache et rapportée en
       succès — avec un `replaceExisting: false` dans la réponse. */
    const réponse = (await (
      await call('/asc/publish', {
        method: 'POST',
        body: publishBody({ dryRun: false, replaceExisting: true }),
        capability: 'asc-publish',
      })
    ).json()) as { idempotent: boolean; replaceExisting: boolean }

    expect(réponse.idempotent).toBe(false)
    expect(réponse.replaceExisting).toBe(true)
    expect(uploads()).toBe(après + 1)
    expect(asc.calls.at(-1)).toContain('--replace')
  })

  it('ne publie rien pour de vrai quand l’appelant a oublié de le demander', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    // Le seul défaut du schéma qui ne soit pas le neutre : un champ omis rend
    // l'appel inoffensif, au lieu de téléverser chez Apple.
    await call('/asc/publish', {
      method: 'POST',
      body: publishBody(),
      capability: 'asc-publish',
    })
    expect(asc.calls.at(-1)).toContain('--dry-run')
  })

  it('un essai à blanc ne compte pas comme une publication', async () => {
    const asc = fakeAsc()
    const { call } = harness(undefined, asc)
    await call('/asc/publish', {
      method: 'POST',
      body: publishBody({ dryRun: true }),
      capability: 'asc-publish',
    })
    expect(asc.calls.at(-1)).toContain('--dry-run')
    const real = (await (
      await call('/asc/publish', {
        method: 'POST',
        body: publishBody(),
        capability: 'asc-publish',
      })
    ).json()) as { idempotent: boolean }
    expect(real.idempotent).toBe(false)
  })

  it('dit que le sort est inconnu après un délai, et ne rejoue rien', async () => {
    const asc = fakeAsc({
      upload: async () => ({ code: 1, stdout: '', stderr: '', timedOut: true }),
    })
    const { call } = harness(undefined, asc)
    const response = await call('/asc/publish', {
      method: 'POST',
      body: publishBody(),
      capability: 'asc-publish',
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'ambiguous-timeout' })
    // Un seul téléversement tenté : le pont ne réessaie pas de lui-même.
    expect(
      asc.calls.filter((args) => args[1] === 'upload' && !args.includes('--help')),
    ).toHaveLength(1)
  })

  it('dit que `asc` manque plutôt que d’échouer en silence', async () => {
    const asc = fakeAsc({ version: null })
    const { call } = harness(undefined, asc)
    const response = await call('/asc/publish', {
      method: 'POST',
      body: publishBody(),
      capability: 'asc-publish',
    })
    expect(response.status).toBe(502)
    const error = (await response.json()) as { error: string; detail: string }
    expect(error.error).toBe('asc-unavailable')
    expect(error.detail).toMatch(/asc/i)
  })

  it('rend la sortie de `asc` nettoyée de tout ce qui ressemble à un secret', async () => {
    const asc = fakeAsc({
      upload: async () => ({
        code: 0,
        stdout: 'issuer_id=69a6de70-dead-beef token: eyJhbGciOi.eyJpc3MiOi.SIGNATURE ok',
        stderr: '',
        timedOut: false,
      }),
    })
    const { call } = harness(undefined, asc)
    const result = (await (
      await call('/asc/publish', {
        method: 'POST',
        body: publishBody(),
        capability: 'asc-publish',
      })
    ).json()) as { output: string }
    expect(result.output).not.toContain('69a6de70')
    expect(result.output).not.toContain('eyJhbGciOi')
    expect(result.output).toContain('[REDACTED]')
    expect(redact('-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----')).toBe(
      '[REDACTED]',
    )
  })

  it('raconte chaque étape, et nettoie le dossier même quand ça échoue', async () => {
    const asc = fakeAsc({
      upload: async () => ({ code: 1, stdout: '', stderr: 'upload refused', timedOut: false }),
    })
    const { call } = harness(undefined, asc)
    const failed = await call('/asc/publish', {
      method: 'POST',
      body: publishBody(),
      capability: 'asc-publish',
    })
    expect(failed.status).toBe(502)
    // L'échec dit *où* il a eu lieu, et que le dossier a quand même été nettoyé.
    const broken = (await failed.json()) as {
      error: string
      steps: { name: string; status: string }[]
    }
    expect(broken.error).toBe('asc-failed')
    expect(broken.steps.map((step) => `${step.name}:${step.status}`)).toEqual([
      'verify-cli:ok',
      'write-temp:ok',
      'upload:failed',
      'cleanup:ok',
    ])

    const fresh = await harness(undefined, fakeAsc()).call('/asc/publish', {
      method: 'POST',
      body: publishBody({ releaseId: 'rel-2' }),
      capability: 'asc-publish',
    })
    const ok = (await fresh.json()) as { steps: { name: string; status: string }[] }
    expect(ok.steps.map((step) => `${step.name}:${step.status}`)).toEqual([
      'verify-cli:ok',
      'write-temp:ok',
      'upload:ok',
      'cleanup:ok',
    ])
  })

  it('refuse --replace quand le binaire installé ne le connaît pas', async () => {
    const asc = fakeAsc()
    asc.run = async (args) => {
      if (args.includes('--help')) {
        return { code: 0, stdout: 'FLAGS\n  --output', stderr: '', timedOut: false }
      }
      return { code: 0, stdout: '0.1.0', stderr: '', timedOut: false }
    }
    const { call } = harness(undefined, asc)
    const response = await call('/asc/publish', {
      method: 'POST',
      body: publishBody({ replaceExisting: true }),
      capability: 'asc-publish',
    })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'asc-unavailable' })
  })
})
