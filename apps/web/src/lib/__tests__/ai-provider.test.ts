import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectBridge, planViaBridge } from '@/lib/bridge-client'
import { AI_PROVIDERS, aiProvider, RECOMMENDED_PROVIDER } from '@/lib/ai/providers'
import { planCampaign } from '@/lib/ai/run'
import { AI_LIMITS } from '@/lib/ai/tools'
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
  direction: 'sobre',
  deviceModel: 'iphone-17-pro',
  screenshots: [
    { label: 'Accueil', assetId: 'asset-1', size: { width: 1320, height: 2868 } },
    { label: 'Budget' },
  ],
  logo: { assetId: 'asset-logo', size: { width: 512, height: 512 } },
}

const HELLO = {
  protocol: 2,
  bridge: '0.1.0',
  codexAvailable: true,
  codexVersion: 'codex-cli 0.0.0-test',
  capabilities: { vision: false, structuredOutput: true, reasoning: true },
  ascAvailable: false,
  tokenVersions: { codex: 1, 'asc-publish': 1 },
}

function respond(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const route = Object.entries(routes).find(([path]) => url.endsWith(path))
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
      expect(['in-process', 'local-bridge']).toContain(entry.transport)
      expect(['none', 'pairing-token']).toContain(entry.auth)
    }
  })

  it('retombe sur le fournisseur local pour un identifiant inconnu', () => {
    expect(aiProvider('inexistant' as never).id).toBe('local')
  })
})

describe('connexion au pont', () => {
  it('dit quoi lancer quand le pont est éteint', async () => {
    respond({})
    const status = await connectBridge(TOKEN)
    expect(status).toMatchObject({ state: 'error', recoverable: true })
    expect(status).toHaveProperty('message', expect.stringContaining('bridge run start'))
  })

  it('refuse une version de protocole différente au lieu de deviner', async () => {
    respond({ '/hello': { body: { ...HELLO, protocol: 99 } } })
    const status = await connectBridge(TOKEN)
    expect(status).toMatchObject({ state: 'error', recoverable: false })
  })

  it('distingue « pont absent » de « codex absent »', async () => {
    respond({ '/hello': { body: { ...HELLO, codexAvailable: false } } })
    const status = await connectBridge(TOKEN)
    expect(status).toHaveProperty('message', expect.stringContaining('codex'))
  })

  it('remonte le refus du jeton tel que le pont le formule', async () => {
    respond({
      '/hello': { body: HELLO },
      '/models': {
        status: 401,
        body: { error: 'unauthorized', detail: 'Jeton d’appairage invalide.' },
      },
    })
    const status = await connectBridge(TOKEN)
    expect(status).toMatchObject({ state: 'error', message: 'Jeton d’appairage invalide.' })
  })

  it('demande le hello sans jeton et les modèles avec', async () => {
    const calls = respond({
      '/hello': { body: HELLO },
      '/models': { body: { models: [{ id: 'modele-test', displayName: 'Modèle test' }] } },
    })
    const status = await connectBridge(TOKEN)
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
        slot: 'Accueil Principal',
        background: { type: 'solid', color: '#f2f3f5' },
        screenshotIndex: 0,
      },
      {
        name: 'Budget',
        headline: 'Chaque euro à sa place',
        background: { type: 'solid', color: '#f2f3f5' },
        screenshotIndex: 7,
      },
    ],
  }

  it('n’envoie aucune image, ni son identifiant', async () => {
    const calls = respond({ '/plan': { body: { plan: PLAN } } })
    await planViaBridge(BRIEF, TOKEN)
    const sent = String(calls[0].init?.body)
    expect(sent).not.toContain('asset-1')
    expect(sent).not.toContain('asset-logo')
    expect(sent).not.toContain('data:')
    expect(JSON.parse(sent).brief.screenshots).toEqual([
      { label: 'Accueil', hasAsset: true },
      { label: 'Budget', hasAsset: false },
    ])
  })

  it('reprend de force ce que l’utilisateur a choisi', async () => {
    respond({ '/plan': { body: { plan: PLAN } } })
    const plan = await planViaBridge(BRIEF, TOKEN)
    expect(plan.appName).toBe('Cadence')
    expect(plan.direction).toBe('sobre')
    expect(plan.deviceModel).toBe('iphone-17-pro')
  })

  it('ignore un index de capture qui ne désigne aucune image', async () => {
    respond({ '/plan': { body: { plan: PLAN } } })
    const plan = await planViaBridge(BRIEF, TOKEN)
    expect(plan.screens[0].screenshotIndex).toBe(0)
    expect(plan.screens[1].screenshotIndex).toBeUndefined()
  })

  it('borne ce que le modèle a écrit', async () => {
    respond({
      '/plan': {
        body: {
          plan: {
            ...PLAN,
            screens: Array.from({ length: 20 }, () => ({
              ...PLAN.screens[0],
              name: 'n'.repeat(200),
              headline: 'h'.repeat(900),
            })),
          },
        },
      },
    })
    const plan = await planViaBridge(BRIEF, TOKEN)
    expect(plan.screens.length).toBe(AI_LIMITS.maxScreens)
    expect(plan.screens[0].name.length).toBe(AI_LIMITS.maxNameLength)
    expect(plan.screens[0].headline.length).toBe(AI_LIMITS.maxTextLength)
    expect(plan.screens[0].slot).toBe('accueil-principal')
  })
})

describe('choix du fournisseur', () => {
  it('compose localement par défaut, sans toucher au réseau', async () => {
    const calls = respond({})
    const plan = await planCampaign(BRIEF)
    expect(calls).toHaveLength(0)
    expect(plan.screens).toHaveLength(2)
  })

  it('compose localement quand le pont est choisi mais pas connecté', async () => {
    const calls = respond({})
    await planCampaign(BRIEF, { provider: 'codex-bridge' })
    expect(calls).toHaveLength(0)
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
                headline: 'Écrit par le modèle',
                background: { type: 'solid', color: '#f2f3f5' },
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
    expect(plan.screens[0].headline).toBe('Écrit par le modèle')
  })
})
