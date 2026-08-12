import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectBridge, planViaBridge } from '@/lib/bridge-client'
import { AI_PROVIDERS, aiProvider, RECOMMENDED_PROVIDER } from '@/lib/ai/providers'
import { planCampaign } from '@/lib/ai/run'
import type { CampaignBrief } from '@/lib/ai/plan'

/**
 * Ce que la page promet au sujet du pont.
 *
 * Deux promesses seulement, et ce sont celles qui coûteraient cher si elles
 * étaient fausses : **aucune image ne part**, et **le brief revient tel que
 * l'utilisateur l'a choisi**. Le reste — les libellés d'erreur — est vérifié
 * parce qu'un message qui ne dit pas quoi faire vaut un échec silencieux.
 *
 * Aucun identifiant réel : le jeton est une chaîne factice, le pont un `fetch`
 * simulé.
 */

const TOKEN = '[REDACTED]'

const BRIEF: CampaignBrief = {
  appName: 'Cadence',
  pitch: 'Le rythme de vos journées',
  productContext: 'Planifiez vos priorités\r\n\r\nVotre semaine visible',
  direction: 'sobre',
  screenCount: 2,
  deviceModel: 'iphone-17-pro',
  screenshots: [
    {
      label: 'Accueil',
      description: 'Les priorités de la journée sont visibles',
      assetId: 'asset-1',
      size: { width: 1320, height: 2868 },
    },
    { label: 'Budget' },
  ],
  logo: { assetId: 'asset-logo', size: { width: 512, height: 512 } },
}

const HELLO = {
  protocol: 4,
  bridge: '0.1.0',
  engines: [
    { id: 'codex', version: 'codex-cli 0.0.0-test' },
    { id: 'claude', version: 'claude-cli 0.0.0-test' },
  ],
  capabilities: { vision: false, structuredOutput: true, reasoning: true },
  ascAvailable: false,
  tokenVersions: { assistant: 1, 'asc-publish': 1 },
}

function respond(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    /* La requête ci-dessus peut porter une chaîne de requête — `/models` prend
       le moteur en paramètre. Comparer sur le chemin seul évite qu'ajouter un
       paramètre ne fasse silencieusement rater la route. */
    const path = url.split('?')[0]
    const route = Object.entries(routes).find(([known]) => path.endsWith(known))
    if (!route) throw new TypeError('Failed to fetch')
    const [, answer] = route
    return {
      ok: (answer.status ?? 200) < 400,
      status: answer.status ?? 200,
      json: async () => answer.body,
    } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registre des fournisseurs', () => {
  it('ne recommande qu’un seul chemin, et c’est celui qui ne demande rien', () => {
    expect(AI_PROVIDERS.filter((entry) => entry.recommended)).toHaveLength(1)
    expect(RECOMMENDED_PROVIDER.id).toBe('local')
    expect(RECOMMENDED_PROVIDER.transport).toBe('in-process')
    expect(RECOMMENDED_PROVIDER.auth).toBe('none')
  })

  it('déclare pour chacun le transport, l’authentification et les capacités', () => {
    for (const entry of AI_PROVIDERS) {
      expect(entry.dataPath.length).toBeGreaterThan(20)
      expect(entry.capabilities).toMatchObject({ tools: false })
      expect(['in-process', 'local-bridge', 'direct-api']).toContain(entry.transport)
      expect(['none', 'pairing-token', 'api-key']).toContain(entry.auth)
      /* Tout fournisseur qui demande un secret dit aussi où le chercher : c'est
         ce que l'installation guidée affiche, et un fournisseur ajouté sans sa
         marche à suivre serait une case à cocher qui ne marche pas. */
      expect(Boolean(entry.setup)).toBe(entry.auth !== 'none')
    }
  })

  it('retombe sur le fournisseur local pour un identifiant inconnu', () => {
    expect(aiProvider('inexistant' as never).id).toBe('local')
  })
})

describe('connexion au pont', () => {
  it('dit quoi lancer quand le pont est éteint', async () => {
    respond({})
    const status = await connectBridge(TOKEN, 'codex')
    expect(status).toMatchObject({ state: 'error', recoverable: true })
    expect(status).toHaveProperty('message', expect.stringContaining('bridge run start'))
  })

  it('refuse une version de protocole différente au lieu de deviner', async () => {
    respond({ '/hello': { body: { ...HELLO, protocol: 99 } } })
    const status = await connectBridge(TOKEN, 'codex')
    expect(status).toMatchObject({ state: 'error', recoverable: false })
  })

  it('distingue « pont absent » de « moteur absent »', async () => {
    respond({ '/hello': { body: { ...HELLO, engines: [] } } })
    const status = await connectBridge(TOKEN, 'codex')
    expect(status).toMatchObject({ state: 'error', recoverable: false })
    expect(status).toHaveProperty('message', expect.stringContaining('codex'))
  })

  it('refuse le moteur que cette machine n’a pas, et nomme lequel', async () => {
    respond({ '/hello': { body: { ...HELLO, engines: [{ id: 'codex' }] } } })
    const status = await connectBridge(TOKEN, 'claude')
    expect(status).toMatchObject({ state: 'error', recoverable: false })
    expect(status).toHaveProperty('message', expect.stringContaining('claude'))
  })

  it('demande les modèles du moteur appairé, pas ceux de l’autre', async () => {
    const calls = respond({
      '/hello': { body: HELLO },
      '/models': { body: { models: [{ id: '', displayName: 'Par défaut' }] } },
    })
    await connectBridge(TOKEN, 'claude')
    expect(calls[1].url).toContain('engine=claude')
  })

  it('remonte le refus du jeton tel que le pont le formule', async () => {
    respond({
      '/hello': { body: HELLO },
      '/models': {
        status: 401,
        body: { error: 'unauthorized', detail: 'Jeton d’appairage invalide.' },
      },
    })
    const status = await connectBridge(TOKEN, 'codex')
    expect(status).toMatchObject({ state: 'error', message: 'Jeton d’appairage invalide.' })
  })

  it('demande le hello sans jeton et les modèles avec', async () => {
    const calls = respond({
      '/hello': { body: HELLO },
      '/models': { body: { models: [{ id: 'modele-test', displayName: 'Modèle test' }] } },
    })
    const status = await connectBridge(TOKEN, 'codex')
    expect(status).toMatchObject({ state: 'ready', models: [{ id: 'modele-test' }] })
    const headers = (init?: RequestInit) => init?.headers as Record<string, string>
    expect(headers(calls[0].init)).not.toHaveProperty('Authorization')
    expect(headers(calls[1].init).Authorization).toBe(`Bearer ${TOKEN}`)
  })
})

describe('plan via le pont', () => {
  const PLAN = {
    appName: 'Autre nom',
    direction: 'nocturne',
    deviceModel: 'iphone-16e',
    screens: [
      {
        name: 'Accueil',
        headline: 'Le rythme de vos journées',
        evidence: 'Le rythme de vos journées',
        slot: 'Accueil Principal',
        background: { type: 'solid', color: '#f2f3f5' },
        screenshotIndex: 0,
      },
      {
        name: 'Budget',
        headline: 'Votre semaine visible',
        evidence: 'Votre semaine visible',
        background: { type: 'solid', color: '#f2f3f5' },
        screenshotIndex: 7,
      },
    ],
  }

  it('n’envoie aucune image, ni son identifiant', async () => {
    const calls = respond({ '/plan': { body: { plan: PLAN } } })
    await planViaBridge(BRIEF, TOKEN, 'codex')
    const sent = String(calls[0].init?.body)
    expect(sent).not.toContain('asset-1')
    expect(sent).not.toContain('asset-logo')
    expect(sent).not.toContain('data:')
    expect(JSON.parse(sent).brief.screenshots).toEqual([
      {
        label: 'Accueil',
        description: 'Les priorités de la journée sont visibles',
        hasAsset: true,
      },
      { label: 'Budget', hasAsset: false },
    ])
    expect(sent).toContain('Planifiez vos priorités')
  })

  it('reprend de force ce que l’utilisateur a choisi', async () => {
    respond({ '/plan': { body: { plan: PLAN } } })
    const plan = await planViaBridge(BRIEF, TOKEN, 'codex')
    expect(plan.appName).toBe('Cadence')
    expect(plan.direction).toBe('sobre')
    expect(plan.deviceModel).toBe('iphone-17-pro')
  })

  it('ignore un index de capture qui ne désigne aucune image', async () => {
    respond({ '/plan': { body: { plan: PLAN } } })
    const plan = await planViaBridge(BRIEF, TOKEN, 'codex')
    expect(plan.screens[0].screenshotIndex).toBe(0)
    expect(plan.screens[1].screenshotIndex).toBeUndefined()
  })

  it('refuse un compte différent au lieu de tronquer le plan', async () => {
    respond({
      '/plan': {
        body: {
          plan: {
            ...PLAN,
            screens: [PLAN.screens[0]],
          },
        },
      },
    })
    await expect(planViaBridge(BRIEF, TOKEN, 'codex')).rejects.toThrow(/au lieu de 2/)
  })

  it('garde la palette du brief, jamais celle que le modèle a rendue', async () => {
    respond({ '/plan': { body: { plan: PLAN } } })
    const custom = { background: '#0a0b0c', ink: '#ffffff', accent: '#ff00aa' }
    const plan = await planViaBridge({ ...BRIEF, palette: custom }, TOKEN, 'codex')
    expect(plan.palette).toEqual(custom)
  })

  it('refuse un brief insuffisant avant tout RPC vers le pont', async () => {
    const calls = respond({ '/plan': { body: { plan: PLAN } } })
    await expect(
      planViaBridge(
        {
          ...BRIEF,
          pitch: 'Budget mensuel toujours clair',
          productContext: undefined,
          screenCount: 4,
          screenshots: [],
        },
        TOKEN,
        'codex',
      ),
    ).rejects.toThrow(/Ajoutez 3 accroches.*réduisez le nombre/i)
    expect(calls).toHaveLength(0)
  })

  it('ignore au pont les doublons et les atomes hors de 3 à 7 mots', async () => {
    const calls = respond({ '/plan': { body: { plan: PLAN } } })
    await expect(
      planViaBridge(
        {
          ...BRIEF,
          pitch: 'Budget mensuel toujours clair',
          productContext:
            ' BUDGET   MENSUEL TOUJOURS CLAIR \nBudget clair\nUn deux trois quatre cinq six sept huit',
          screenCount: 4,
          screenshots: [],
        },
        TOKEN,
        'codex',
      ),
    ).rejects.toThrow(/Ajoutez 3 accroches.*réduisez le nombre/i)
    expect(calls).toHaveLength(0)
  })

  it('bloque avant RPC les collisions finales, les génériques et les faits trop longs', async () => {
    const tooLong = 'Anticonstitutionnellement Anticonstitutionnellement Anticonstitutionnellement'
    const cases = [
      {
        pitch: 'Budget éclairé chaque mois',
        productContext: 'Budget eclaire chaque mois\nBudget éclairé, chaque mois!',
        screenCount: 3,
      },
      {
        pitch: 'À votre rythme, à votre image',
        productContext: undefined,
        screenCount: 1,
      },
      { pitch: tooLong, productContext: undefined, screenCount: 1 },
    ] as const
    for (const entry of cases) {
      const calls = respond({ '/plan': { body: { plan: PLAN } } })
      await expect(
        planViaBridge({ ...BRIEF, ...entry, screenshots: [] }, TOKEN, 'codex'),
      ).rejects.toThrow(/Ajoutez .*réduisez le nombre/i)
      expect(calls).toHaveLength(0)
    }
  })

  it('appelle le pont quand quatre faits distincts couvrent quatre visuels', async () => {
    const facts = [
      'Budget mensuel toujours clair',
      'Dépenses importantes bien anticipées',
      'Objectifs annuels toujours visibles',
      'Épargne sous contrôle',
    ] as const
    const written = {
      ...PLAN,
      screens: facts.map((fact, index) => ({
        name: `Visuel ${index + 1}`,
        headline: fact,
        evidence: fact,
      })),
    }
    const calls = respond({ '/plan': { body: { plan: written } } })
    const plan = await planViaBridge(
      {
        ...BRIEF,
        pitch: facts[0],
        productContext: facts.slice(1).join('\n'),
        screenCount: 4,
        screenshots: [],
      },
      TOKEN,
      'codex',
    )
    expect(calls).toHaveLength(1)
    expect(plan.screens).toHaveLength(4)
  })
})

describe('choix du fournisseur', () => {
  it('compose localement par défaut, sans toucher au réseau', async () => {
    const calls = respond({})
    const plan = await planCampaign(BRIEF)
    expect(calls).toHaveLength(0)
    expect(plan.screens).toHaveLength(2)
  })

  it('garde la composition locale disponible sans aucun fait IA éligible', async () => {
    const calls = respond({})
    const plan = await planCampaign({
      ...BRIEF,
      pitch: '',
      productContext: undefined,
      screenCount: 4,
      screenshots: [],
    })
    expect(calls).toHaveLength(0)
    expect(plan.screens).toHaveLength(4)
  })

  it('compose localement quand le pont est choisi mais pas connecté', async () => {
    const calls = respond({})
    await planCampaign(BRIEF, { provider: 'codex-bridge' })
    expect(calls).toHaveLength(0)
  })

  it('compose localement quand une clé est présentée sans modèle choisi', async () => {
    const calls = respond({})
    // Ces API n'ont pas de modèle par défaut, et en coder un en dur reviendrait
    // à choisir un tarif à la place de l'utilisateur.
    await planCampaign(BRIEF, { provider: 'anthropic', token: TOKEN })
    expect(calls).toHaveLength(0)
  })

  it('envoie le moteur choisi au pont, et pas un autre', async () => {
    const calls = respond({
      '/plan': {
        body: {
          plan: {
            appName: 'Cadence',
            direction: 'sobre',
            deviceModel: 'iphone-17-pro',
            screens: [
              {
                name: 'Accueil',
                headline: 'Le rythme de vos journées',
                evidence: 'Le rythme de vos journées',
                background: { type: 'solid', color: '#f2f3f5' },
              },
              {
                name: 'Budget',
                headline: 'Votre semaine visible',
                evidence: 'Votre semaine visible',
              },
            ],
          },
        },
      },
    })
    await planCampaign(BRIEF, { provider: 'claude-bridge', token: TOKEN })
    expect(JSON.parse(String(calls[0].init?.body)).engine).toBe('claude')
  })

  it('passe par le pont dès qu’un jeton est présenté', async () => {
    const calls = respond({
      '/plan': {
        body: {
          plan: {
            appName: 'Cadence',
            direction: 'sobre',
            deviceModel: 'iphone-17-pro',
            screens: [
              {
                name: 'Accueil',
                headline: 'Le rythme de vos journées',
                evidence: 'Le rythme de vos journées',
                background: { type: 'solid', color: '#f2f3f5' },
              },
              {
                name: 'Budget',
                headline: 'Votre semaine visible',
                evidence: 'Votre semaine visible',
              },
            ],
          },
        },
      },
    })
    const plan = await planCampaign(BRIEF, {
      provider: 'codex-bridge',
      token: TOKEN,
      model: 'modele-test',
    })
    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0].init?.body)).model).toBe('modele-test')
    expect(plan.screens[0].headline).toBe('Le rythme de vos journées')
  })
})
