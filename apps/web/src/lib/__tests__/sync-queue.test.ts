import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { clearSyncRecords, listSyncRecords, syncKey, writeSyncRecord } from '@/lib/sync-queue'

it('efface seulement les accusés du compte demandé', async () => {
  await writeSyncRecord({ key: syncKey('owner', 'one'), pushedUpdatedAt: 1, uploadedAssetIds: [] })
  await writeSyncRecord({ key: syncKey('other', 'two'), pushedUpdatedAt: 2, uploadedAssetIds: [] })

  await clearSyncRecords('owner')

  expect(await listSyncRecords('owner')).toEqual([])
  expect((await listSyncRecords('other')).map((row) => row.key)).toEqual(['other:two'])
})
