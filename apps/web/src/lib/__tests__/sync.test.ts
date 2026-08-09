import { describe, expect, it } from 'vitest'
import { fetchRemoteProjectRows, mapBounded, mapBoundedSettled } from '@/lib/sync'

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

  it('borne aussi les échecs isolés et conserve tous les résultats', async () => {
    let active = 0
    let maximum = 0
    const visited: number[] = []

    const results = await mapBoundedSettled([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1
      maximum = Math.max(maximum, active)
      await Promise.resolve()
      active -= 1
      visited.push(value)
      if (value === 2) throw new Error('upload failed')
      return value
    })

    expect(maximum).toBe(2)
    expect(visited.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ])
  })
})

describe('catalogue cloud paginé', () => {
  it('lit plus de mille projets par pages stables et bornées', async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({
      id: String(index).padStart(4, '0'),
      data: {},
      updated_at: '2026-08-09T12:00:00.000Z',
    }))
    const ranges: [number, number][] = []
    const orders: [string, boolean][] = []
    let active = 0
    let maximum = 0
    const query = {
      order(column: string, options: { ascending: boolean }) {
        orders.push([column, options.ascending])
        return this
      },
      async range(from: number, to: number) {
        ranges.push([from, to])
        active += 1
        maximum = Math.max(maximum, active)
        await Promise.resolve()
        active -= 1
        return { data: rows.slice(from, to + 1), error: null }
      },
    }
    const client = {
      from: () => ({ select: () => query }),
    }

    const result = await fetchRemoteProjectRows(client as never)

    expect(result).toHaveLength(1_001)
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
      [1_000, 1_499],
    ])
    expect(maximum).toBe(1)
    expect(orders).toEqual([
      ['updated_at', false],
      ['id', true],
      ['updated_at', false],
      ['id', true],
      ['updated_at', false],
      ['id', true],
    ])
  })
})
