import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { cloudAccount, errorCode, testConvex } from './test.helpers'

async function expiredCloudAccount(t: ReturnType<typeof testConvex>): Promise<Id<'users'>> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {})
    await ctx.db.insert('entitlements', {
      userId,
      polarCustomerId: `cus_${userId}`,
      cloudStatus: 'canceled',
      cloudPeriodEnd: '2020-01-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    })
    await ctx.db.insert('userSettings', { userId, theme: 'light', updatedAt: 10 })
    return userId
  })
}

describe('userSettings', () => {
  it('upsert une seule préférence strictement plus récente', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const as = t.withIdentity({ subject: userId })

    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'light', updatedAt: 10 }),
    ).resolves.toBe('accepted')
    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 10 }),
    ).resolves.toBe('stale')
    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 9 }),
    ).resolves.toBe('stale')
    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 11 }),
    ).resolves.toBe('accepted')
    await expect(as.query(api.settings.mySettings, {})).resolves.toEqual({
      theme: 'dark',
      updatedAt: 11,
    })
  })

  it('isole lecture et écriture par identité sans accepter de userId', async () => {
    const t = testConvex()
    const first = await cloudAccount(t)
    const second = await cloudAccount(t)
    const firstSession = t.withIdentity({ subject: first })
    const secondSession = t.withIdentity({ subject: second })

    await firstSession.mutation(api.settings.upsertSettings, { theme: 'light', updatedAt: 10 })
    await expect(secondSession.query(api.settings.mySettings, {})).resolves.toBeNull()
    await secondSession.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 20 })

    await expect(firstSession.query(api.settings.mySettings, {})).resolves.toEqual({
      theme: 'light',
      updatedAt: 10,
    })
    await expect(secondSession.query(api.settings.mySettings, {})).resolves.toEqual({
      theme: 'dark',
      updatedAt: 20,
    })
  })

  it('refuse les champs inconnus et les dates invalides', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const as = t.withIdentity({ subject: userId })

    await expect(
      as.mutation(api.settings.upsertSettings, {
        theme: 'dark',
        updatedAt: 1,
        apiKey: 'secret',
      } as never),
    ).rejects.toBeDefined()
    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: -1 }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'SETTINGS_REJECTED')
  })

  it('reste lisible mais non modifiable après expiration Cloud', async () => {
    const t = testConvex()
    const userId = await expiredCloudAccount(t)
    const as = t.withIdentity({ subject: userId })

    await expect(as.query(api.settings.mySettings, {})).resolves.toEqual({
      theme: 'light',
      updatedAt: 10,
    })
    await expect(
      as.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 11 }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'CLOUD_REQUIRED')
  })

  it('refuse toute opération sans session', async () => {
    const t = testConvex()
    await expect(t.query(api.settings.mySettings, {})).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    await expect(
      t.mutation(api.settings.upsertSettings, { theme: 'dark', updatedAt: 1 }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'UNAUTHENTICATED')
  })
})
