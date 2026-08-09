import { describe, expect, it } from 'vitest'
import { mapBounded } from '@/lib/sync'

describe('mapBounded', () => {
  it('attend tous les workers avant de propager le premier rejet', async () => {
    let release!: () => void
    const slow = new Promise<void>((resolve) => {
      release = resolve
    })
    let returned = false

    const outcome = mapBounded([0, 1], 2, async (value) => {
      if (value === 0) throw new Error('first worker failed')
      await slow
      return value
    }).then(
      () => 'fulfilled' as const,
      () => 'rejected' as const,
    )
    void outcome.then(() => {
      returned = true
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(returned).toBe(false)

    release()
    await expect(outcome).resolves.toBe('rejected')
  })

  it('ne dépasse jamais la concurrence demandée', async () => {
    let active = 0
    let maximum = 0

    const values = await mapBounded([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return value * 2
    })

    expect(maximum).toBe(2)
    expect(values).toEqual([2, 4, 6, 8, 10])
  })
})
