import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, type Page } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le relais du démon, tenu par le test, en vrai HTTP.
 *
 * Ce n'est pas une facilité : un `page.route` ne sait pas tenir une réponse
 * ouverte, or tout le protocole repose sur un flux SSE que le démon garde en
 * vie. La contrepartie est que les tests parlent le protocole plutôt que de le
 * simuler — une route renommée dans `apps/mcp` casse cette suite, ce qui est
 * exactement ce qu'on attend d'un contrat.
 *
 * Le port est tiré au sort et poussé dans le stockage local de la page. En dur
 * sur 4591, ces tests auraient parlé au vrai démon de quiconque en développe un
 * sur cette machine — et la machine qui fait tourner cette suite est
 * précisément celle-là.
 */

export const TOKEN = 'jeton-de-test-mcp'

export interface Answer {
  id: string
  ok: boolean
  result?: {
    layerIds?: string[]
    screenIds?: string[]
    screenId?: string
    width?: number
    height?: number
    data?: string
    id?: string
    name?: string
    templates?: { id: string; name: string; source: string; layerCount: number }[]
  }
  error?: string
}

export interface Relay {
  port: number
  answers: Answer[]
  states: unknown[]
  /** Flux ouverts moins flux refermés : le témoin de la coupure. */
  live: () => number
  /** Cumulé, jamais décrémenté : c'est lui qui distingue « pas encore » de « plus ». */
  opened: () => number
  /** Fait entrer des octets dans le coffre, comme un appel d'outil le ferait. */
  serve: (id: string, bytes: Buffer, mediaType?: string) => void
  /** Les identifiants que la page est allée chercher, dans l'ordre. */
  claims: () => string[]
  push: (id: string, calls: unknown[]) => void
  askRender: (id: string, render: { screenId?: string; maxWidth?: number }) => void
  askSaveTemplate: (id: string, save: { name: string; screenId?: string }) => void
  askListTemplates: (id: string) => void
  waitForStream: () => Promise<void>
  stop: () => Promise<void>
}

export async function startRelay(port = 0): Promise<Relay> {
  const answers: Answer[] = []
  const states: unknown[] = []
  const assets = new Map<string, { bytes: Buffer; mediaType: string }>()
  const claims: string[] = []
  let stream: ServerResponse | null = null
  let opened = 0
  let closed = 0

  const server: Server = createServer((request, response) => {
    const origin = request.headers.origin ?? '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, cors).end()
      return
    }

    const url = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (url.pathname === '/pair') {
      response
        .writeHead(200, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ protocol: 1, mcp: '0.1.0-test', token: TOKEN }))
      return
    }

    if (url.pathname === '/events') {
      if (url.searchParams.get('token') !== TOKEN) {
        response.writeHead(401, cors).end()
        return
      }
      response.writeHead(200, {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      response.write(': relais de test\n\n')
      stream = response
      opened += 1
      request.on('close', () => {
        closed += 1
        if (stream === response) stream = null
      })
      return
    }

    /* Le coffre ne sert rien qu'un appel d'outil n'y ait fait entrer, et rien
       sans jeton : c'est ce que la page doit trouver en face d'elle pour que le
       test dise quelque chose du vrai démon. */
    if (url.pathname.startsWith('/asset/')) {
      if (request.headers.authorization !== `Bearer ${TOKEN}`) {
        response.writeHead(401, cors).end()
        return
      }
      const id = url.pathname.slice('/asset/'.length)
      claims.push(id)
      const asset = assets.get(id)
      if (!asset) {
        response.writeHead(404, { ...cors, 'Content-Type': 'application/json' }).end('{}')
        return
      }
      response.writeHead(200, { ...cors, 'Content-Type': asset.mediaType }).end(asset.bytes)
      return
    }

    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    request.on('end', () => {
      if (request.headers.authorization !== `Bearer ${TOKEN}`) {
        response.writeHead(401, cors).end()
        return
      }
      const payload = JSON.parse(body || '{}') as Answer & { state?: unknown }
      if (url.pathname === '/result') answers.push(payload)
      if (url.pathname === '/state') states.push(payload.state)
      response.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end('{}')
    })
  })

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Relais sans port.')

  const frame = (payload: unknown) => {
    if (!stream) throw new Error('Aucun flux ouvert : la page n’est pas connectée.')
    stream.write(`event: calls\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  return {
    port: (address as AddressInfo).port,
    answers,
    states,
    live: () => opened - closed,
    opened: () => opened,
    serve: (id, bytes, mediaType = 'image/png') => assets.set(id, { bytes, mediaType }),
    claims: () => claims,
    push: (id, calls) => frame({ id, calls }),
    askRender: (id, render) => frame({ id, render }),
    askSaveTemplate: (id, saveTemplate) => frame({ id, saveTemplate }),
    askListTemplates: (id) => frame({ id, listTemplates: true }),
    waitForStream: async () => {
      await expect.poll(() => opened, { timeout: 10_000 }).toBeGreaterThan(0)
    },
    stop: () =>
      new Promise<void>((resolve) => {
        stream?.end()
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

export async function connect(page: Page, relay: Relay): Promise<void> {
  await page.addInitScript((port: number) => {
    localStorage.setItem('screenforge-mcp-port', String(port))
  }, relay.port)
  await waitForApp(page)

  await page.getByRole('button', { name: 'Connexion MCP' }).click()
  const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
  await expect(dialog).toBeVisible()
  // Le mode est éteint tant que personne ne l'a demandé : c'est « Activer »
  // qui s'offre, pas « Désactiver ».
  await expect(dialog.getByRole('button', { name: 'Activer' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Activer' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Connectée')
  await relay.waitForStream()
}
