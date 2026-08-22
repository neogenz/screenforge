import { describe, expect, it, vi } from 'vitest'

const catalogueMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listSyncRecords: vi.fn(),
}))

/* Hissé au-dessus des imports par vitest, donc posé ici et pas dans le test :
   `@/lib/sync` est importé statiquement plus bas, et un `doMock` après coup
   rendrait le module déjà évalué, lié au vrai transport. */
vi.mock('@/lib/cloud', () => ({
  CloudUploadError: class CloudUploadError extends Error {
    constructor(readonly outcome: string) {
      super(outcome)
    }
  },
  listRemoteProjects: () =>
    Promise.resolve([
      { projectId: 'b', name: 'B', updatedAt: 10 },
      { projectId: 'a', name: 'A', updatedAt: 30 },
      { projectId: 'c', name: 'C', updatedAt: 30 },
    ]),
}))

vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage')>()),
  listProjects: catalogueMocks.listProjects,
}))

vi.mock('@/lib/sync-queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sync-queue')>()),
  listSyncRecords: catalogueMocks.listSyncRecords,
}))

import {
  canCreateSyncRecord,
  cloudQuotaMessage,
  consentRequiredProjectIds,
  fetchRemoteProjectRows,
  mapBounded,
  mapBoundedSettled,
  PROJECT_AVAILABILITY_LABELS,
  listProjectCatalogue,
  projectAvailabilityCatalogue,
} from '@/lib/sync'
import { useAuthStore } from '@/stores/auth.store'

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

describe('disponibilité du catalogue local', () => {
  const projects = [
    { id: 'device', name: 'Appareil', target: 'app-store-iphone', updatedAt: 10 },
    { id: 'pending', name: 'Attente', target: 'app-store-iphone', updatedAt: 30 },
    { id: 'cloud-b', name: 'Cloud B', target: 'app-store-iphone', updatedAt: 20 },
    { id: 'cloud-a', name: 'Cloud A', target: 'app-store-iphone', updatedAt: 20 },
  ] as const
  const records = [
    { key: 'owner:pending', pushedUpdatedAt: 29, uploadedAssetIds: [] },
    { key: 'owner:cloud-a', pushedUpdatedAt: 20, uploadedAssetIds: [] },
    { key: 'owner:cloud-b', pushedUpdatedAt: 21, uploadedAssetIds: [] },
  ] as const

  it('classe les trois états et trie par fraîcheur puis identifiant', () => {
    expect(PROJECT_AVAILABILITY_LABELS).toEqual({
      'device-only': 'Cet appareil',
      cloud: 'Cloud',
      pending: 'À synchroniser',
    })
    expect(
      projectAvailabilityCatalogue(projects, 'owner', records).map(({ id, availability }) => ({
        id,
        availability,
      })),
    ).toEqual([
      { id: 'pending', availability: 'pending' },
      { id: 'cloud-a', availability: 'cloud' },
      { id: 'cloud-b', availability: 'cloud' },
      { id: 'device', availability: 'device-only' },
    ])
  })

  it('annonce seulement cet appareil sans session et ne modifie pas ses sources', () => {
    const projectsBefore = structuredClone(projects)
    const recordsBefore = structuredClone(records)

    expect(
      projectAvailabilityCatalogue(projects, null, records).every(
        ({ availability }) => availability === 'device-only',
      ),
    ).toBe(true)
    expect(projects).toEqual(projectsBefore)
    expect(records).toEqual(recordsBefore)
  })

  it('ignore les anciens accusés sans session Cloud active', async () => {
    catalogueMocks.listProjects.mockResolvedValue(
      projects.map((project) => ({ ...project, createdAt: 1 })),
    )
    catalogueMocks.listSyncRecords.mockResolvedValue(records)
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'owner', email: null },
      entitlements: null,
      entitlementsVerified: false,
    })

    expect(
      (await listProjectCatalogue()).every(({ availability }) => availability === 'device-only'),
    ).toBe(true)
    expect(catalogueMocks.listSyncRecords).not.toHaveBeenCalled()

    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      entitlements: null,
      entitlementsVerified: false,
    })
  })
})

describe('barrière de consentement Cloud', () => {
  const projects = [
    { id: 'historical', createdAt: 1, updatedAt: 2 },
    { id: 'attached', createdAt: 1, updatedAt: 3 },
    { id: 'empty', createdAt: 4, updatedAt: 4 },
  ] as const

  it('protège les projets locaux touchés qui ne sont pas rattachés à ce compte', () => {
    expect(
      consentRequiredProjectIds(projects, 'owner', [
        { key: 'owner:attached' },
        { key: 'other:historical' },
      ]),
    ).toEqual(new Set(['historical']))
  })

  it('échoue fermé pendant la classification puis autorise seulement les nouveaux ids', () => {
    expect(
      canCreateSyncRecord({ userId: 'owner', ready: false, projectIds: new Set() }, 'owner', 'new'),
    ).toBe(false)

    const barrier = {
      userId: 'owner',
      ready: true,
      projectIds: new Set(['historical']),
    }
    expect(canCreateSyncRecord(barrier, 'other', 'new')).toBe(false)
    expect(canCreateSyncRecord(barrier, 'owner', 'historical')).toBe(false)
    expect(canCreateSyncRecord(barrier, 'owner', 'new')).toBe(true)
  })
})

it('les refus de quota nomment la limite sans exposer de détail serveur', () => {
  expect(cloudQuotaMessage('project-count-limit')).toMatch(/100 projets/)
  expect(cloudQuotaMessage('asset-storage-limit')).toMatch(/512 Mio/)
  expect(cloudQuotaMessage('unknown')).toBeUndefined()
})
