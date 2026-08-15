import { describe, expect, it } from 'vitest'
import { createRelay, createRelayState, type RelayState } from './relay/server.ts'
import { AppUnavailableError, RelaySession } from './relay/session.ts'

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
    const { state, app } = relay()

    const granted = await app.request('/pair', { method: 'POST', headers: { Origin: ORIGIN } })
    expect(granted.status).toBe(200)
    expect(await granted.json()).toMatchObject({ token: state.pairing.token, protocol: 1 })

    const refused = await app.request('/pair', {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
    })
    expect(refused.status).toBe(403)
    /* Le 403 part nu : sans en-tête CORS, le navigateur retient la réponse et
       la page hostile ne lit même pas le refus. */
    expect(refused.headers.get('Access-Control-Allow-Origin')).toBeNull()
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
