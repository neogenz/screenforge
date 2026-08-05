import { afterEach, describe, expect, it, vi } from 'vitest'
import { installThumbnails } from '@/lib/canvas/install-thumbnails'
import type { Screen } from '@/types'

afterEach(() => {
  vi.useRealTimers()
})

describe('installThumbnails', () => {
  it('cancels pending generation during cleanup', () => {
    vi.useFakeTimers()
    const currentCanvas = vi.fn(() => null)
    const onGenerated = vi.fn()
    const scheduler = installThumbnails({ currentCanvas, onGenerated })

    scheduler.schedule([{ id: 'screen' } as Screen])
    scheduler.cleanup()
    vi.runAllTimers()

    expect(currentCanvas).not.toHaveBeenCalled()
    expect(onGenerated).not.toHaveBeenCalled()
  })
})
