import { afterEach, describe, expect, it, vi } from 'vitest'

function stubFonts(load: (font: string) => Promise<FontFace[]>) {
  const link = { sheet: {}, remove: vi.fn() } as unknown as HTMLLinkElement
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

  it('replaces a failed stylesheet before retrying', async () => {
    let failedRemoved = false
    const failedLink = {
      sheet: null,
      addEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === 'error') queueMicrotask(listener)
      }),
      removeEventListener: vi.fn(),
      remove: vi.fn(() => { failedRemoved = true }),
    } as unknown as HTMLLinkElement
    const loadedLink = { sheet: {}, dataset: {} } as unknown as HTMLLinkElement
    const appendChild = vi.fn()
    const load = vi.fn().mockResolvedValue([{} as FontFace])
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('document', {
      querySelector: () => failedRemoved ? null : failedLink,
      createElement: () => loadedLink,
      head: { appendChild },
      fonts: { load, ready: Promise.resolve() },
    } as unknown as Document)
    const { loadGoogleFont } = await import('@/lib/fonts')

    await expect(loadGoogleFont('Network Retry Sans', ['400']))
      .resolves.toMatchObject({ status: 'fallback' })
    await expect(loadGoogleFont('Network Retry Sans', ['400']))
      .resolves.toMatchObject({ status: 'loaded' })

    expect(failedLink.remove).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledWith(loadedLink)
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
