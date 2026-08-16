import { expect, test, vi } from 'vitest'
import { internal } from './_generated/api'
import { cloudAccount, testConvex } from './test.helpers'

test('le balayage borné conserve les blobs référencés et supprime les orphelins', async () => {
  const t = testConvex()
  const userId = await cloudAccount(t)
  const report = vi.spyOn(console, 'info').mockImplementation(() => {})
  const { project, asset, orphan } = await t.run(async (ctx) => {
    const project = await ctx.storage.store(new Blob(['project']))
    const asset = await ctx.storage.store(new Blob(['asset']))
    const orphan = await ctx.storage.store(new Blob(['orphan']))
    await ctx.db.insert('projects', {
      userId,
      projectId: 'p',
      name: 'p',
      updatedAt: 1,
      blobId: project,
      byteLength: 7,
    })
    await ctx.db.insert('assets', {
      userId,
      assetId: 'a',
      storageId: asset,
      contentType: 'image/png',
      byteLength: 5,
    })
    return { project, asset, orphan }
  })

  const first = await t.mutation(internal.maintenance.sweepOrphanBlobs, {
    cursor: null,
    visited: 0,
    deleted: 0,
  })
  expect(first).toMatchObject({ done: true, visited: 3, deleted: 1 })
  await expect(t.run((ctx) => ctx.db.system.get(project))).resolves.not.toBeNull()
  await expect(t.run((ctx) => ctx.db.system.get(asset))).resolves.not.toBeNull()
  await expect(t.run((ctx) => ctx.db.system.get(orphan))).resolves.toBeNull()

  const second = await t.mutation(internal.maintenance.sweepOrphanBlobs, {
    cursor: null,
    visited: 0,
    deleted: 0,
  })
  expect(second).toMatchObject({ done: true, visited: 2, deleted: 0 })
  expect(report).toHaveBeenCalledTimes(2)
})
