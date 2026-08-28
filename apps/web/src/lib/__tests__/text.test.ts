import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chunked,
  mapPool,
  runTextJob,
  TEXT_BATCH,
  TEXT_CONCURRENCY,
  textWriterUnavailable,
} from '@/lib/ai/text'
import { forgetAssistant, rememberAssistant, type AssistantConnection } from '@/lib/ai/session'
import { setBridgeToken } from '@/lib/bridge-client'

/**
 * Ce qu'un travail de texte promet : le rédacteur de la session, un lot
 * découpé sous la borne du pont, l'ordre conservé, et un compte faux refusé en
 * bloc. Aucun secret réel, un `fetch` simulé qui relit ce qu'on lui envoie.
 */

vi.mock('@/lib/ai/key-store', () => ({
  rememberOnDisk: vi.fn(async () => undefined),
  recallFromDisk: vi.fn(async () => null),
  forgetOnDisk: vi.fn(async () => undefined),
}))

const READY: AssistantConnection = { state: 'ready', models: [], detail: '' }

function answering(reply: (body: Record<string, unknown>, url: string) => unknown) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] =
    []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> })
      return new Response(JSON.stringify(reply(body, url)), { status: 200 })
    }),
  )
  return calls
}

/** Rend autant de textes que le prompt en numérote (`1. …`), corrigés si demandé. */
function replyFor(body: Record<string, unknown>, corrected: string[] = []) {
  const prompt = String((body.messages as { content: string }[])[0].content)
  const count = prompt.split('\n').filter((line) => /^\d+\. /.test(line)).length
  const texts = Array.from({ length: count }, (_, index) => corrected[index] ?? `texte ${index}`)
  return { content: [{ type: 'text', text: `Voici : ${JSON.stringify({ texts })}` }] }
}

beforeEach(() => forgetAssistant())
afterEach(() => vi.unstubAllGlobals())

describe('mapPool', () => {
  it('n’ouvre jamais plus de `limit` travaux et rend dans l’ordre', async () => {
    let inFlight = 0
    let peak = 0
    const out = await mapPool([30, 5, 20, 1, 10], 2, async (delay, index) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, delay))
      inFlight -= 1
      return `${index}:${delay}`
    })
    expect(out).toEqual(['0:30', '1:5', '2:20', '3:1', '4:10'])
    expect(peak).toBe(2)
    expect(await mapPool([], 2, async () => 'jamais')).toEqual([])
  })

  it('rejette entier au premier échec', async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('quota')
        return item
      }),
    ).rejects.toThrow('quota')
  })
})

describe('runTextJob', () => {
  it('découpe sous la borne du pont et rend les textes dans l’ordre', () => {
    expect(chunked([1, 2, 3], 2)).toEqual([[1, 2], [3]])
    expect(chunked([]).length).toBe(0)
    expect(TEXT_BATCH).toBeLessThanOrEqual(120)
  })

  it('nomme pourquoi rien ne peut être écrit', () => {
    expect(textWriterUnavailable()).toMatch(/choisissez qui écrit/i)
    rememberAssistant({
      providerId: 'claude-bridge',
      secret: 'jeton',
      connection: { state: 'idle' },
    })
    expect(textWriterUnavailable()).toMatch(/pas connecté/)
    rememberAssistant({ connection: READY })
    expect(textWriterUnavailable()).toBeNull()
    rememberAssistant({ providerId: 'anthropic', model: '' })
    expect(textWriterUnavailable()).toMatch(/modèle/)
  })

  it('traduit par le pont, par lots, sans identifiant de calque', async () => {
    rememberAssistant({ providerId: 'claude-bridge', secret: 'jeton', connection: READY })
    setBridgeToken('assistant', 'jeton', 'claude')
    const calls = answering((body) => ({
      texts: (body.texts as string[]).map((text) => `[de] ${text}`),
    }))
    const texts = Array.from({ length: TEXT_BATCH + 5 }, (_, index) => `Texte ${index}`)
    const out = await runTextJob(
      {
        kind: 'translate',
        source: { code: 'fr-FR', name: 'Français' },
        target: { code: 'de-DE', name: 'Allemand', script: 'latin' },
      },
      texts,
      { appName: 'Cadence', pitch: 'Le rythme' },
    )
    expect(out).toHaveLength(texts.length)
    expect(out[0]).toBe('[de] Texte 0')
    expect(out[out.length - 1]).toBe(`[de] Texte ${TEXT_BATCH + 4}`)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toContain('/translate')
    expect(calls[0].headers.Authorization).toBe('Bearer jeton')
    expect(calls[0].body).toMatchObject({
      protocol: 7,
      source: { code: 'fr-FR' },
      target: { code: 'de-DE', script: 'latin' },
      context: { appName: 'Cadence' },
      engine: 'claude',
    })
    expect(JSON.stringify(calls[0].body)).not.toMatch(/layerId|assetId|data:image/)
  })

  it('tient deux requêtes en vol sur 250 textes, ordre gardé, et rejette entier', async () => {
    rememberAssistant({ providerId: 'claude-bridge', secret: 'jeton', connection: READY })
    setBridgeToken('assistant', 'jeton', 'claude')
    let inFlight = 0
    let peak = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        const body = JSON.parse(String(init?.body ?? '{}')) as { texts: string[] }
        return new Response(JSON.stringify({ texts: body.texts.map((text) => `[de] ${text}`) }), {
          status: 200,
        })
      }),
    )
    const texts = Array.from({ length: 250 }, (_, index) => `Texte ${index}`)
    const out = await runTextJob(
      { kind: 'translate', target: { code: 'de-DE', name: 'Allemand', script: 'latin' } },
      texts,
    )
    expect(out).toEqual(texts.map((text) => `[de] ${text}`))
    expect(peak).toBe(TEXT_CONCURRENCY)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)

    // La deuxième requête refuse : tout est refusé, rien n'est rendu en partie.
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls += 1
        if (calls === 2) return new Response('{"error":"quota"}', { status: 429 })
        const body = JSON.parse(String(init?.body ?? '{}')) as { texts: string[] }
        return new Response(JSON.stringify({ texts: body.texts }), { status: 200 })
      }),
    )
    await expect(
      runTextJob(
        { kind: 'translate', target: { code: 'de-DE', name: 'Allemand', script: 'latin' } },
        texts,
      ),
    ).rejects.toThrow()
  })

  it('refuse en bloc un lot rendu d’une autre longueur', async () => {
    rememberAssistant({ providerId: 'claude-bridge', secret: 'jeton', connection: READY })
    answering((body) => ({ texts: (body.texts as string[]).slice(1) }))
    await expect(
      runTextJob({ kind: 'proofread', language: { code: 'fr-FR', name: 'Français' } }, ['a', 'b']),
    ).rejects.toThrow(/nombre de textes inattendu/)
  })

  it('relit par une clé directe, en JSON, avec un plafond de sortie relevé', async () => {
    rememberAssistant({
      providerId: 'anthropic',
      secret: 'sk-test',
      model: 'claude-test',
      connection: READY,
    })
    const calls = answering((body) => replyFor(body, ['Le rythme', 'Chaque euro']))
    const out = await runTextJob(
      { kind: 'proofread', language: { code: 'fr-FR', name: 'Français' } },
      ['Le rytme', 'Chaque euro'],
    )
    expect(out).toEqual(['Le rythme', 'Chaque euro'])
    expect(calls[0].url).toContain('/messages')
    expect(calls[0].body.max_tokens).toBe(4096)
    expect(calls[0].body.model).toBe('claude-test')
    expect(String((calls[0].body.messages as { content: string }[])[0].content)).toContain(
      '1. Le rytme',
    )
  })
})
