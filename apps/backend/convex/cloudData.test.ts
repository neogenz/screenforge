import { CLOUD_OFFER } from '@screenforge/project-format'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import { cloudAccount, errorCode, testConvex } from './test.helpers'

describe('données Cloud du compte', () => {
  it('mesure seulement les lignes du propriétaire et refuse l’anonyme', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    await t.run(async (ctx) => {
      const ownerBlob = await ctx.storage.store(new Blob(['owner']))
      const otherBlob = await ctx.storage.store(new Blob(['other']))
      await ctx.db.insert('projects', {
        userId: owner,
        projectId: 'p',
        name: 'P',
        updatedAt: 1,
        blobId: ownerBlob,
        byteLength: 5,
      })
      await ctx.db.insert('assets', {
        userId: owner,
        assetId: 'a',
        storageId: ownerBlob,
        contentType: 'image/png',
        byteLength: 7,
      })
      await ctx.db.insert('assets', {
        userId: other,
        assetId: 'secret',
        storageId: otherBlob,
        contentType: 'image/png',
        byteLength: 999,
      })
    })

    await expect(t.query(api.cloudData.myUsage, {})).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    expect(await t.withIdentity({ subject: owner }).query(api.cloudData.myUsage, {})).toEqual({
      projects: {
        count: 1,
        bytes: 5,
        limitCount: CLOUD_OFFER.limits.projects,
        limitBytes: CLOUD_OFFER.limits.projectBytes,
      },
      assets: {
        count: 1,
        bytes: 7,
        limitCount: CLOUD_OFFER.limits.assets,
        limitBytes: CLOUD_OFFER.limits.assetBytes,
      },
    })
  })

  it('purge par passes, reste idempotent et conserve identité et droit', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    await t.run(async (ctx) => {
      const shared = await ctx.storage.store(new Blob(['x']))
      for (let index = 0; index < 201; index += 1) {
        await ctx.db.insert('assets', {
          userId: owner,
          assetId: `a-${index}`,
          storageId: shared,
          contentType: 'image/png',
          byteLength: 1,
        })
      }
      await ctx.db.insert('userSettings', { userId: owner, theme: 'dark', updatedAt: 1 })
      await ctx.db.insert('assets', {
        userId: other,
        assetId: 'kept',
        storageId: shared,
        contentType: 'image/png',
        byteLength: 1,
      })
    })

    const caller = t.withIdentity({ subject: owner })
    expect(await caller.mutation(api.cloudData.clearMyCloudData, {})).toBe('incomplete')
    expect(await caller.mutation(api.cloudData.clearMyCloudData, {})).toBe('cleared')
    expect(await caller.mutation(api.cloudData.clearMyCloudData, {})).toBe('cleared')

    await t.run(async (ctx) => {
      expect(await ctx.db.get(owner)).not.toBeNull()
      expect(
        await ctx.db
          .query('entitlements')
          .withIndex('by_user', (q) => q.eq('userId', owner))
          .unique(),
      ).not.toBeNull()
      expect(
        await ctx.db
          .query('assets')
          .withIndex('by_user', (q) => q.eq('userId', owner))
          .collect(),
      ).toEqual([])
      expect(
        await ctx.db
          .query('assets')
          .withIndex('by_user', (q) => q.eq('userId', other))
          .unique(),
      ).not.toBeNull()
    })
  })

  it('invalide un upload autorisé avant la purge', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const caller = t.withIdentity({ subject: owner })
    const generation = await caller.mutation(internal.projects.authorizeProjectUpload, {
      projectId: 'retardataire',
      name: 'Retardataire',
      updatedAt: 1,
      contentType: 'application/json',
      byteLength: 2,
    })
    const blobId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['{}'], { type: 'application/json' })),
    )

    expect(await caller.mutation(api.cloudData.clearMyCloudData, {})).toBe('cleared')
    expect(
      await caller.mutation(internal.projects.commitProjectUpload, {
        projectId: 'retardataire',
        name: 'Retardataire',
        updatedAt: 1,
        blobId,
        generation,
      }),
    ).toBe('invalidated')
    await expect(
      t.run((ctx) =>
        ctx.db
          .query('projects')
          .withIndex('by_user', (q) => q.eq('userId', owner))
          .collect(),
      ),
    ).resolves.toEqual([])
  })
})
