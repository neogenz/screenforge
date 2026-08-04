import { afterEach, describe, expect, it, vi } from 'vitest'

function stubFonts(load: (font: string) => Promise<FontFace[]>) {
  const link = { sheet: {} } as HTMLLinkElement
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  vi.stubGlobal('document', {
    querySelector: () => link,
    fonts: { load, ready: Promise.resolve() },
  } as unknown as Document)
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe('loadGoogleFont', () => {
  it('evicts a failed request so the same face can be retried', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{} as FontFace])
    stubFonts(load)
    const { isFontLoaded, loadGoogleFont } = await import('@/lib/fonts')

    await expect(loadGoogleFont('Retry Sans', ['400']))
      .resolves.toMatchObject({ status: 'fallback' })
    await expect(loadGoogleFont('Retry Sans', ['400']))
      .resolves.toMatchObject({ status: 'loaded' })

    expect(load).toHaveBeenCalledTimes(2)
    expect(isFontLoaded('Retry Sans', ['400'])).toBe(true)
  })

  it('deduplicates concurrent requests for the same face', async () => {
    let resolveFace!: (faces: FontFace[]) => void
    const load = vi.fn(() => new Promise<FontFace[]>((resolve) => {
      resolveFace = resolve
    }))
    stubFonts(load)
    const { loadGoogleFont } = await import('@/lib/fonts')

    const first = loadGoogleFont('Concurrent Sans', ['400'])
    const second = loadGoogleFont('Concurrent Sans', ['400'])

    expect(second).toBe(first)
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(1)
    resolveFace([{} as FontFace])
    await expect(first).resolves.toMatchObject({ status: 'loaded' })
  })
})
