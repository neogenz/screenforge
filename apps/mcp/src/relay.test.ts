import { describe, expect, it } from 'vitest'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { validateAgainst } from '@screenforge/project-format'
import { createRelay, createRelayState, type RelayState } from './relay/server.ts'
import { AppUnavailableError, RelaySession } from './relay/session.ts'
import { registerEditorTools } from './tools/editor-tools.ts'
import { renderThumbnail } from './tools/get-thumbnail.ts'
import { LIST_TEMPLATES_OUTPUT, SAVE_TEMPLATE_OUTPUT } from './tools/templates.ts'

/**
 * Le relais se teste sans navigateur : Hono répond à une `Request` fabriquée,
 * et le flux SSE est un `ReadableStream` qu'on lit à la main.
 */

const ORIGIN = 'http://localhost:5173'

function relay(state: RelayState = createRelayState()) {
  return { state, app: createRelay(state, [ORIGIN]) }
}

/** Lit les événements du flux au fur et à mesure, sans le consommer d'un coup. */
async function* sseEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += value
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const event = /^event:\s*(.*)$/m.exec(frame)?.[1]
      const data = /^data:\s*(.*)$/m.exec(frame)?.[1]
      if (event) yield { event, data: data ?? '' }
      boundary = buffer.indexOf('\n\n')
    }
  }
}

async function openStream(state: RelayState, app: ReturnType<typeof createRelay>) {
  const response = await app.request(`/events?token=${state.pairing.token}`, {
    headers: { Origin: ORIGIN },
  })
  expect(response.status).toBe(200)
  const events = sseEvents(response.body!)
  /* `attach` se produit dans le corps du gestionnaire, après que la réponse est
     rendue : on attend que le démon se sache branché avant de lui parler. */
  while (!state.session.connected) await new Promise((resolve) => setTimeout(resolve, 1))
  return events
}

describe('appairage', () => {
  it('rend le jeton à une origine admise et refuse les autres', async () => {
    const codes: string[] = []
    let nextCode = 123456
    const state = createRelayState({
      mintCode: () => String(nextCode++),
      announce: (code) => codes.push(code),
    })
    const { app } = relay(state)

    const granted = await app.request('/pair', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codes[0] }),
    })
    expect(granted.status).toBe(200)
    expect(await granted.json()).toMatchObject({ token: state.pairing.token, protocol: 1 })

    const refused = await app.request('/pair', {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
      body: JSON.stringify({ code: '123456' }),
    })
    expect(refused.status).toBe(403)
    /* Le 403 part nu : sans en-tête CORS, le navigateur retient la réponse et
       la page hostile ne lit même pas le refus. */
    expect(refused.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('exige origine et code, borne les essais et rend le code non rejouable', async () => {
    let now = 1_000
    let nextCode = 111_111
    const state = createRelayState({
      now: () => now,
      mintCode: () => String(nextCode++),
    })
    const { app } = relay(state)
    const request = (code: string, origin = ORIGIN) =>
      app.request('/pair', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

    expect((await request('111111', '')).status).toBe(403)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request('000000')).status).toBe(401)
    }
    expect((await request('111111')).status).toBe(401)
    now += 10 * 60_000
    expect((await request('111111')).status).toBe(401)
    const granted = await request('111112')
    expect(granted.status).toBe(200)
    const token = ((await granted.json()) as { token: string }).token
    expect(token).toBe(state.pairing.token)
    expect((await request('111112')).status).toBe(401)
    expect((await request('111113')).status).toBe(200)
  })

  it('révoque le flux, les appels et l’ancien bearer côté démon', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)
    const oldToken = state.pairing.token
    const pending = state.session.dispatch({ calls: [{ tool: 'add_screen', args: {} }] })
    await events.next()

    const revoked = await app.request('/revoke', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${oldToken}` },
    })
    expect(revoked.status).toBe(200)
    await expect(pending).rejects.toThrow(/révoquée/)
    expect(state.session.connected).toBe(false)
    expect(
      (
        await app.request('/state', {
          method: 'POST',
          headers: { Origin: ORIGIN, Authorization: `Bearer ${oldToken}` },
          body: JSON.stringify({ state: {} }),
        })
      ).status,
    ).toBe(401)
  })

  it('refuse le flux et les réponses sans le jeton', async () => {
    const { app } = relay()
    expect((await app.request('/events?token=faux', { headers: { Origin: ORIGIN } })).status).toBe(
      401,
    )
    expect(
      (
        await app.request('/result', {
          method: 'POST',
          headers: { Origin: ORIGIN, Authorization: 'Bearer faux' },
          body: '{}',
        })
      ).status,
    ).toBe(401)
  })
})

describe('aller-retour', () => {
  it('pousse le lot dans le flux et rend la réponse à l’appelant', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)

    const answer = state.session.dispatch({
      calls: [{ tool: 'add_screen', args: { name: 'Accueil' } }],
    })
    const frame = await events.next()
    expect(frame.value?.event).toBe('calls')
    const request = JSON.parse(frame.value!.data) as { id: string; calls: unknown[] }
    expect(request.calls).toEqual([{ tool: 'add_screen', args: { name: 'Accueil' } }])

    const settled = await app.request('/result', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
      body: JSON.stringify({ id: request.id, ok: true, result: { screenId: 'ecran-2' } }),
    })
    expect(await settled.json()).toEqual({ settled: true })
    await expect(answer).resolves.toEqual({ screenId: 'ecran-2' })
  })

  it('accepte l’état poussé et le rend au démon', async () => {
    const { state, app } = relay()
    const pushed = await app.request('/state', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
      body: JSON.stringify({ state: { name: 'Projet', screens: [] } }),
    })
    expect(pushed.status).toBe(200)
    expect(state.session.state).toEqual({ name: 'Projet', screens: [] })
  })

  it('ignore une réponse dont l’appel n’attend plus', async () => {
    const { state, app } = relay()
    const late = await app.request('/result', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
      body: JSON.stringify({ id: 'oublié', ok: true }),
    })
    expect(await late.json()).toEqual({ settled: false })
  })
})

describe('la miniature', () => {
  /** Répond à la demande que le démon vient de pousser, comme le ferait l'onglet. */
  async function answerRender(
    state: RelayState,
    app: ReturnType<typeof createRelay>,
    events: AsyncGenerator<{ event: string; data: string }>,
    findings: string[],
  ) {
    const answered = renderThumbnail(state.session, {})
    const frame = await events.next()
    expect(frame.value?.event).toBe('calls')
    const request = JSON.parse(frame.value!.data) as { id: string }
    await app.request('/result', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
      body: JSON.stringify({
        id: request.id,
        ok: true,
        result: { screenId: 's1', width: 640, height: 1391, data: 'UE5H', findings },
      }),
    })
    return answered
  }

  it('met le constat avant l’image, et ne le rend jamais en erreur', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)
    const result = await answerRender(state, app, events, [
      '« Accroche » : 154 px de texte dans une boîte de 40 px.',
    ])

    // Un constat n'est pas un refus : une composition qui déborde exprès est
    // légitime, et l'agent décide de ce qu'il corrige.
    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({ type: 'text' })
    expect((result.content[0] as { text: string }).text).toMatch(/boîte de 40 px/)
    expect(result.content[1]).toMatchObject({ type: 'image', mimeType: 'image/png' })
  })

  it('dit qu’il n’y a rien plutôt que de ne rien dire', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)
    const result = await answerRender(state, app, events, [])

    // Un bloc vide se lit comme une mesure qui n'a pas eu lieu, et l'agent
    // repart alors juger à l'œil — ce que la boucle existe pour éviter.
    const text = (result.content[0] as { text: string }).text
    expect(text).toMatch(/Aucun défaut mesuré/)
    expect(result.content).toHaveLength(2)
  })

  it('double son constat en sortie structurée, sans y remettre le PNG', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)
    const result = await answerRender(state, app, events, ['Un défaut.'])

    expect(result.structuredContent).toEqual({
      screenId: 's1',
      width: 640,
      height: 1391,
      findings: ['Un défaut.'],
    })
    // Le base64 reste dans son bloc image : l'y remettre transporterait deux
    // fois le même octet.
    expect(JSON.stringify(result.structuredContent)).not.toContain('UE5H')
  })
})

/**
 * Ce qui est réellement enregistré, relu tel quel.
 *
 * La table des titres pourrait être complète et l'appel à `registerTool`
 * l'ignorer : c'est le catalogue publié qui compte, pas la table qui le nourrit.
 */
type ToolRun = (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult

function catalogue(state: RelayState = createRelayState()) {
  const registered = new Map<string, { config: Record<string, unknown>; run: ToolRun }>()
  const server = {
    registerTool: (name: string, config: Record<string, unknown>, run: ToolRun) => {
      registered.set(name, { config, run })
    },
  } as unknown as McpServer
  registerEditorTools(server, state)
  return registered
}

describe('le catalogue publié', () => {
  it('donne à chaque outil un titre lisible, jamais son adresse', () => {
    const tools = catalogue()
    expect(tools.size).toBeGreaterThanOrEqual(19)
    for (const [name, { config }] of tools) {
      // Un client MCP affiche le nom faute de titre : « screenforge_add_device »
      // dans une liste de permissions ne dit pas qu'on va poser un iPhone.
      expect(config.title, name).toBeTruthy()
      expect(String(config.title), name).not.toMatch(/screenforge_|_/)
    }
  })

  it('ne déclare une forme de sortie que là où elle est courte et stable', () => {
    const declared = [...catalogue()]
      .filter(([, { config }]) => config.outputSchema !== undefined)
      .map(([name]) => name)
      .sort()

    // La vue complète du projet n'en a pas : la recopier en JSON Schema serait
    // une seconde déclaration tenue à la main, et le SDK fait échouer l'appel
    // dont la sortie ne s'y conforme pas.
    expect(declared).toEqual([
      'screenforge_get_thumbnail',
      'screenforge_list_templates',
      'screenforge_save_template',
    ])
  })

  it('rend la lecture du projet en bloc texte seul', async () => {
    const { state, app } = relay()
    await app.request('/state', {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
      body: JSON.stringify({ state: { name: 'Projet', screens: [] } }),
    })

    const result = await catalogue(state).get('screenforge_get_project_state')!.run({})
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent).toBeUndefined()
    expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({
      name: 'Projet',
    })
  })

  it('rend une sortie structurée conforme à la forme qu’il déclare', async () => {
    const { state, app } = relay()
    const events = await openStream(state, app)
    const tools = catalogue(state)
    const fiche = {
      id: 'gab-1',
      name: 'Plein cadre',
      description: 'Accroche haute, appareil centré',
      source: 'user',
      layerCount: 4,
      createdAt: 1_755_000_000_000,
    }

    for (const [name, answer, schema] of [
      ['screenforge_save_template', fiche, SAVE_TEMPLATE_OUTPUT],
      ['screenforge_list_templates', { templates: [fiche] }, LIST_TEMPLATES_OUTPUT],
    ] as const) {
      const answered = tools.get(name)!.run({ name: 'Plein cadre' })
      const frame = await events.next()
      await app.request('/result', {
        method: 'POST',
        headers: { Origin: ORIGIN, Authorization: `Bearer ${state.pairing.token}` },
        body: JSON.stringify({
          id: (JSON.parse(frame.value!.data) as { id: string }).id,
          ok: true,
          result: answer,
        }),
      })
      const result = await answered

      // Le SDK refuse l'appel dont la sortie ne se conforme pas au schéma
      // déclaré : le vérifier ici est la seule façon de l'apprendre avant
      // l'agent. Le bloc texte reste, pour les clients qui ne lisent que lui.
      expect(result.isError, name).toBeUndefined()
      expect(validateAgainst(schema, result.structuredContent), name).toBeNull()
      expect(JSON.parse((result.content[0] as { text: string }).text), name).toEqual(answer)
    }
  })

  it('ne fait jamais suivre un refus d’une sortie structurée', async () => {
    // `save_template` déclare une forme et n'a pas d'éditeur branché : c'est le
    // cas où une sortie valide à côté d'une erreur inviterait à lire la première.
    const result = await catalogue().get('screenforge_save_template')!.run({ name: 'Gabarit' })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toBeUndefined()
  })
})

describe('un seul éditeur à la fois', () => {
  it('évince le flux précédent et fait échouer ses appels en vol', async () => {
    const { state, app } = relay()
    const first = await openStream(state, app)
    const orphan = state.session.dispatch({ calls: [{ tool: 'add_screen', args: {} }] })
    await first.next()

    await openStream(state, app)

    await expect(orphan).rejects.toThrow(/remplacé/)
    expect(state.session.connected).toBe(true)
    /* L'état est oublié à la bascule : le nouvel onglet ouvre peut-être un
       autre projet, et un état hérité mentirait jusqu'à sa première écriture. */
    expect(state.session.state).toBeNull()
  })
})

describe('la session ne laisse rien en suspens', () => {
  it('refuse de dispatcher quand aucun éditeur n’est branché', async () => {
    await expect(
      new RelaySession().dispatch({ calls: [{ tool: 'add_screen', args: {} }] }),
    ).rejects.toThrow(AppUnavailableError)
  })

  it('fait échouer les appels en vol à la déconnexion', async () => {
    const session = new RelaySession()
    const connection = { send: () => {}, close: () => {} }
    session.attach(connection)
    const pending = session.dispatch({ calls: [{ tool: 'add_screen', args: {} }] })
    session.detach(connection)
    await expect(pending).rejects.toThrow(/déconnecté/)
  })

  it('ne débranche pas l’éditeur arrivé après celui qu’on évince', () => {
    const session = new RelaySession()
    const evicted = { send: () => {}, close: () => {} }
    const current = { send: () => {}, close: () => {} }
    session.attach(evicted)
    session.attach(current)
    session.detach(evicted)
    expect(session.connected).toBe(true)
  })

  it('rend la main quand l’éditeur ne répond pas', async () => {
    const session = new RelaySession({ timeoutMs: 5 })
    session.attach({ send: () => {}, close: () => {} })
    await expect(session.dispatch({ calls: [{ tool: 'add_screen', args: {} }] })).rejects.toThrow(
      /60 s/,
    )
  })
})
