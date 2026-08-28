import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chunked, runTextJob, TEXT_BATCH, textWriterUnavailable } from '@/lib/ai/text'
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

beforeEach(() => forgetAssistant())
afterEach(() => vi.unstubAllGlobals())

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
    const calls = answering((body) => ({
      content: [
        {
          type: 'text',
          text: `Voici : ${JSON.stringify({ texts: JSON.parse(String((body.messages as { content: string }[])[0].content.split('\n').filter((line: string) => /^\d+\. /.test(line)).length)) ? ['Le rythme', 'Chaque euro'] : [] })}`,
        },
      ],
    }))
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
