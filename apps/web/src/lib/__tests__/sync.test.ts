import { describe, expect, it, vi } from 'vitest'

/* Hissé au-dessus des imports par vitest, donc posé ici et pas dans le test :
   `@/lib/sync` est importé statiquement plus bas, et un `doMock` après coup
   rendrait le module déjà évalué, lié au vrai transport. */
vi.mock('@/lib/cloud', () => ({
  listRemoteProjects: () =>
    Promise.resolve([
      { projectId: 'b', name: 'B', updatedAt: 10 },
      { projectId: 'a', name: 'A', updatedAt: 30 },
      { projectId: 'c', name: 'C', updatedAt: 30 },
    ]),
}))

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

describe('catalogue cloud', () => {
  it('trie par fraîcheur puis par identifiant, quel que soit l’ordre reçu', async () => {
    /* L'ordre n'est pas cosmétique : `pullTarget` adopte `rows[0]` quand
       l'éditeur n'a rien à lui, donc « le plus récent » doit être en tête et
       les ex æquo doivent être départagés de façon stable — sinon deux
       navigateurs sur le même compte adoptent deux projets différents.
       Un index Convex ne trie pas sur deux champs quelconques, donc l'ordre
       est refait ici plutôt que demandé au serveur. */
    expect((await fetchRemoteProjectRows()).map((row) => row.projectId)).toEqual(['a', 'c', 'b'])
  })
})
