import { describe, expect, it } from 'vitest'
import { waitForExportWorkers } from '@/hooks/use-export'

describe('workers d’export', () => {
  it('garde l’interface occupée jusqu’au dernier worker après un rejet', async () => {
    let releaseSlow!: () => void
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })
    let uiReleased = false

    const exportRun = (async () => {
      try {
        await waitForExportWorkers([Promise.reject(new Error('render failed')), slow])
      } finally {
        uiReleased = true
      }
    })()
    const observed = exportRun.catch((error: unknown) => error)

    await Promise.resolve()
    await Promise.resolve()
    expect(uiReleased).toBe(false)

    releaseSlow()
    await expect(observed).resolves.toMatchObject({ message: 'render failed' })
    expect(uiReleased).toBe(true)
  })
})
