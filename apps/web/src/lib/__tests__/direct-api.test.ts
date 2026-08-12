import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiKey, connectApiProvider, extractJson, planViaApi, setApiKey } from '@/lib/ai/direct-api'
import { assignArchetypes, backgroundFor } from '@/lib/ai/archetypes'
import { planScreenLayout } from '@/lib/ai/plan'
import type { CampaignBrief } from '@/lib/ai/plan'

/**
 * Ce que la page promet au sujet des fournisseurs à clé.
 *
 * Trois promesses, et ce sont celles qui coûteraient cher si elles étaient
 * fausses : **aucune image ne part**, **la clé n'est écrite nulle part**, et
 * **le brief revient tel que l'utilisateur l'a choisi**. Un modèle distant a le
 * droit d'écrire les mots ; il n'a pas le droit de changer la palette, le nom de
 * l'application ni le nombre de visuels demandés.
 *
 * Aucun identifiant réel : la clé est une chaîne factice, l'API un `fetch`
 * simulé. Rien de ce fichier ne sort de la machine.
 */

const KEY = '[REDACTED]'

const BRIEF: CampaignBrief = {
  appName: 'Cadence',
  pitch: 'Le rythme de vos journées',
  direction: 'sobre',
  screenCount: 2,
  deviceModel: 'iphone-17-pro',
  screenshots: [
    { label: 'Accueil', assetId: 'asset-1', size: { width: 1320, height: 2868 } },
    { label: 'Budget' },
  ],
  logo: { assetId: 'asset-logo', size: { width: 512, height: 512 } },
}

function respond(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const route = Object.entries(routes).find(([path]) => url.includes(path))
      if (!route) throw new TypeError('Failed to fetch')
      const [, answer] = route
      return {
        ok: (answer.status ?? 200) < 400,
        status: answer.status ?? 200,
        json: async () => answer.body,
      } as Response
    }),
  )
  return calls
}

/** Un plan écrit par le modèle, avec de quoi vérifier ce qui est repris de force. */
function answering(
  text: string,
  provider: 'anthropic' | 'openrouter' = 'anthropic',
): Record<string, { status?: number; body: unknown }> {
  return provider === 'anthropic'
    ? { '/messages': { body: { content: [{ type: 'text', text }] } } }
    : { '/chat/completions': { body: { choices: [{ message: { content: text } }] } } }
}

const WRITTEN = JSON.stringify({
  screens: [
    {
      name: 'Accueil',
      headline: 'Vos journées, enfin lisibles',
      slot: 'Accueil Principal',
      background: { color: '#101114' },
      screenshotIndex: 0,
    },
    {
      name: 'Budget',
      headline: 'Chaque euro à sa place',
      background: { color: 'pas une couleur' },
      screenshotIndex: 7,
    },
  ],
})

afterEach(() => {
  vi.unstubAllGlobals()
  setApiKey('anthropic', '')
  setApiKey('openrouter', '')
})

/**
 * Un stockage qui enregistre au lieu de stocker.
 *
 * Le test tourne sans navigateur, donc il n'y a rien à relire après coup : ce
 * qui est vérifié est qu'aucune écriture n'est **tentée**. C'est la forme forte
 * — un `setItem` ajouté demain à `direct-api.ts` ferait tomber ce test, là où
 * relire un stockage vide n'aurait rien prouvé de plus qu'en l'absence du
 * navigateur.
 */
function recordingStorage() {
  const writes: string[] = []
  const fake = {
    setItem: (_name: string, value: string) => writes.push(value),
    getItem: () => null,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  }
  vi.stubGlobal('localStorage', fake)
  vi.stubGlobal('sessionStorage', fake)
  return writes
}

describe('la clé reste en mémoire', () => {
  it('ne l’écrit ni dans le stockage local, ni dans le stockage de session', () => {
    const writes = recordingStorage()
    setApiKey('anthropic', KEY)
    expect(apiKey('anthropic')).toBe(KEY)
    expect(writes).toEqual([])
  })

  it('garde les deux fournisseurs séparés : une clé ne vaut pas pour l’autre', () => {
    setApiKey('anthropic', KEY)
    expect(apiKey('openrouter')).toBe('')
  })
})

describe('connexion', () => {
  it('valide la clé en demandant le catalogue, sans facturer un tour', async () => {
    const calls = respond({
      '/models': { body: { data: [{ id: 'claude-x', display_name: 'Claude X' }] } },
    })
    const status = await connectApiProvider('anthropic', KEY)
    expect(status).toMatchObject({ state: 'ready', models: [{ id: 'claude-x' }] })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/models')
  })

  it('présente la clé d’Anthropic là où Anthropic l’attend, et pas ailleurs', async () => {
    const calls = respond({ '/models': { body: { data: [{ id: 'claude-x' }] } } })
    await connectApiProvider('anthropic', KEY)
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe(KEY)
    expect(headers).not.toHaveProperty('Authorization')
    expect(headers['anthropic-version']).toBeTruthy()
  })

  it('présente la clé d’OpenRouter en porteur', async () => {
    const calls = respond({ '/models': { body: { data: [{ id: 'un/modele' }] } } })
    await connectApiProvider('openrouter', KEY)
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(headers).not.toHaveProperty('x-api-key')
  })

  it('dit quoi faire d’une clé refusée, pas un code', async () => {
    respond({ '/models': { status: 401, body: {} } })
    const status = await connectApiProvider('anthropic', KEY)
    expect(status.state).toBe('error')
    expect(status).toHaveProperty('message', expect.stringContaining('recopiée'))
  })

  it('ne prétend pas être connecté sur un catalogue vide', async () => {
    respond({ '/models': { body: { data: [] } } })
    expect((await connectApiProvider('anthropic', KEY)).state).toBe('error')
  })
})

describe('plan via une API', () => {
  it('n’envoie aucune image, ni son identifiant', async () => {
    const calls = respond(answering(WRITTEN))
    await planViaApi('anthropic', BRIEF, KEY, 'claude-x')
    const sent = String(calls[0].init?.body)
    expect(sent).not.toContain('asset-1')
    expect(sent).not.toContain('asset-logo')
    expect(sent).not.toContain('data:')
    // Les libellés partent, eux : c'est ce qui permet au modèle d'écrire dans
    // l'ordre des captures, et c'est ce que le fournisseur annonce.
    expect(sent).toContain('Accueil')
  })

  it('reprend de force ce que l’utilisateur a choisi', async () => {
    respond(answering(JSON.stringify({ ...JSON.parse(WRITTEN), appName: 'Autre nom' })))
    const custom = { background: '#0a0b0c', ink: '#ffffff', accent: '#ff00aa' }
    const plan = await planViaApi('anthropic', { ...BRIEF, palette: custom }, KEY, 'claude-x')
    expect(plan.appName).toBe('Cadence')
    expect(plan.direction).toBe('sobre')
    expect(plan.deviceModel).toBe('iphone-17-pro')
    expect(plan.palette).toEqual(custom)
  })

  it('borne le nombre de visuels aux deux plafonds', async () => {
    const many = JSON.stringify({
      screens: Array.from({ length: 20 }, () => JSON.parse(WRITTEN).screens[0]),
    })
    respond(answering(many))
    expect((await planViaApi('anthropic', BRIEF, KEY, 'claude-x')).screens).toHaveLength(2)

    respond(answering(many))
    const generous = await planViaApi('anthropic', { ...BRIEF, screenCount: 20 }, KEY, 'claude-x')
    expect(generous.screens).toHaveLength(10)
  })

  it('normalise le rôle et ignore un index de capture qui ne désigne rien', async () => {
    respond(answering(WRITTEN))
    const plan = await planViaApi('anthropic', BRIEF, KEY, 'claude-x')
    expect(plan.screens[0].slot).toBe('accueil-principal')
    expect(plan.screens[0].screenshotIndex).toBe(0)
    expect(plan.screens[1].screenshotIndex).toBeUndefined()
  })

  it('compose le fond depuis le rang, et non depuis ce que le modèle a proposé', async () => {
    respond(answering(WRITTEN))
    const plan = await planViaApi('anthropic', BRIEF, KEY, 'claude-x')
    /* Le modèle a rendu « #101114 » sur le premier visuel et « pas une
       couleur » sur le second. Ni l'un ni l'autre n'arrive : le fond appartient
       à la composition, la composition au rang, et le visuel planifié n'en
       porte aucun. Deux visuels voisins ne partagent donc jamais le même. */
    expect(plan.screens[0]).not.toHaveProperty('background')
    const fonds = plan.screens.map(
      (_unused, index) => planScreenLayout(plan, BRIEF, index)?.background,
    )
    expect(fonds[0]).toEqual(backgroundFor(assignArchetypes(2)[0], plan.palette))
    expect(fonds[1]).toEqual(backgroundFor(assignArchetypes(2)[1], plan.palette))
    expect(fonds[0]).not.toEqual(fonds[1])
  })

  it('n’envoie plus au modèle de couleur à choisir', async () => {
    const calls = respond(answering(WRITTEN))
    await planViaApi('anthropic', BRIEF, KEY, 'claude-x')
    expect(String(calls[0].init?.body)).not.toContain('background')
  })

  it('accepte un JSON encadré de politesses plutôt que de faire repayer le tour', async () => {
    respond(answering(`Voici le plan :\n\`\`\`json\n${WRITTEN}\n\`\`\`\nBonne journée.`))
    const plan = await planViaApi('anthropic', BRIEF, KEY, 'claude-x')
    expect(plan.screens[0].headline).toBe('Vos journées, enfin lisibles')
  })

  it('refuse une réponse qui ne contient aucun JSON', () => {
    expect(() => extractJson('Je ne peux pas vous aider.')).toThrow()
  })

  it('passe par OpenRouter quand c’est OpenRouter qui est choisi', async () => {
    const calls = respond(answering(WRITTEN, 'openrouter'))
    const plan = await planViaApi('openrouter', BRIEF, KEY, 'un/modele')
    expect(calls[0].url).toContain('openrouter.ai')
    expect(plan.screens[0].headline).toBe('Vos journées, enfin lisibles')
  })
})
