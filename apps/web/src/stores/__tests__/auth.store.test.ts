import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeCheckoutReturn } from '../auth.store'

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('consumeCheckoutReturn', () => {
  it('retire immédiatement le jeton Polar de l’URL', async () => {
    vi.useFakeTimers()
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost:5173/?checkout=success&customer_session_token=secret&source=test',
      },
      history: { replaceState },
    })

    consumeCheckoutReturn()

    expect(replaceState).toHaveBeenCalledWith(null, '', 'http://localhost:5173/?source=test')
    await Promise.resolve()
  })
})
