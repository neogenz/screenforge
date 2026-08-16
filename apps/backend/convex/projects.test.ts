import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { MAX_PROJECT_BYTES_PER_ACCOUNT, MAX_PROJECTS_PER_ACCOUNT } from './limits'
import { MAX_PROJECT_BLOB_BYTES } from './media'
import { cloudAccount, errorCode, testConvex } from './test.helpers'

type Test = ReturnType<typeof testConvex>
type ProjectRow = { projectId: string; name: string; updatedAt: number }

function screen(index: number) {
  return {
    id: `screen-${index}`,
    name: `Écran ${index + 1}`,
    background: { type: 'solid', color: '#0f172a' },
    layers: Array.from({ length: 24 }, (_, rank) => ({
      id: `layer-${index}-${rank}`,
      type: 'text',
      text: 'Concevez vos captures App Store sans quitter le navigateur, en toute autonomie.',
      left: rank,
      top: rank,
      width: 1080,
      height: 132,
      fontFamily: 'Inter',
      fontSize: 64,
      fill: '#f8fafc',
    })),
  }
}

function heavyProject() {
  const snapshot = {
    name: 'ScreenForge',
    screens: Array.from({ length: 10 }, (_, index) => screen(index)),
    layoutLayers: [],
    globals: {},
  }
  return {
    ...snapshot,
    id: 'project-lourd',
    updatedAt: 1_770_000_000_000,
    releases: Array.from({ length: 20 }, (_, rank) => ({
      id: `release-${rank}`,
      createdAt: rank,
      locale: 'fr-FR',
      snapshot,
    })),
    locales: Array.from({ length: 12 }, (_, rank) => ({
      locale: `loc-${rank}`,
      overrides: Object.fromEntries(
        Array.from({ length: 40 }, (_, key) => [`layer-${key}`, 'Texte localisé']),
      ),
    })),
  }
}

async function push(t: Test, userId: Id<'users'>, row: ProjectRow, payload: unknown) {
  const query = new URLSearchParams({
    projectId: row.projectId,
    name: row.name,
    updatedAt: String(row.updatedAt),
  })
  const response = await t.withIdentity({ subject: userId }).fetch(`/upload/project?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
  })
  const body = (await response.json()) as { outcome: string }
  return { response, outcome: body.outcome }
}

async function pushAsset(
  t: Test,
  userId: Id<'users'>,
  assetId: string,
  bytes: Uint8Array<ArrayBuffer>,
) {
  const query = new URLSearchParams({ assetId })
  return await t.withIdentity({ subject: userId }).fetch(`/upload/asset?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: new Blob([bytes], { type: 'image/png' }),
  })
}

async function project(t: Test, userId: Id<'users'>, projectId: string) {
  return await t.run((ctx) =>
    ctx.db
      .query('projects')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', projectId))
      .unique(),
  )
}

async function stored(t: Test, storageId: Id<'_storage'>) {
  return (await t.run((ctx) => ctx.db.system.get(storageId))) !== null
}

async function storageCount(t: Test) {
  return (await t.run((ctx) => ctx.db.system.query('_storage').collect())).length
}

describe('upload projet possédé par le serveur', () => {
  it('fait l’aller-retour du pire projet mesuré au-dessus de 1 MiB', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const payload = heavyProject()
    expect(new Blob([JSON.stringify(payload)]).size).toBeGreaterThan(1024 * 1024)

    expect(
      (await push(t, userId, { projectId: payload.id, name: 'Lourd', updatedAt: 1 }, payload))
        .outcome,
    ).toBe('accepted')
    const response = await t.withIdentity({ subject: userId }).fetch(`/project-blob/${payload.id}`)
    expect(await response.json()).toEqual(payload)
  })

  it('refuse avant stockage une requête anonyme, trop grosse ou mal typée', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const query = 'projectId=p&name=p&updatedAt=1'
    const anonymous = await t.fetch(`/upload/project?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(anonymous.status).toBe(401)

    const oversized = await t.withIdentity({ subject: userId }).fetch(`/upload/project?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new Uint8Array(MAX_PROJECT_BLOB_BYTES + 1),
    })
    expect(oversized.status).toBe(413)

    const wrongType = await t.withIdentity({ subject: userId }).fetch(`/upload/project?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    })
    expect(wrongType.status).toBe(400)
    expect(await storageCount(t)).toBe(0)
  })

  it('répond au préflight sans exposer de capacité Storage', async () => {
    const response = await testConvex().fetch('/upload/project', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    expect(response.headers.get('Vary')).toBe('Origin')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*')
  })
})

describe('dernier écrivain gagne sans fichier orphelin', () => {
  it('garde la version la plus récente, quel que soit l’ordre', async () => {
    for (const order of [
      [100, 200],
      [200, 100],
    ]) {
      const t = testConvex()
      const userId = await cloudAccount(t)
      for (const updatedAt of order) {
        await push(t, userId, { projectId: 'p', name: `v${updatedAt}`, updatedAt }, { updatedAt })
      }
      expect(
        await t.withIdentity({ subject: userId }).query(api.projects.listProjects, {}),
      ).toEqual([{ projectId: 'p', name: 'v200', updatedAt: 200 }])
      expect(await storageCount(t)).toBe(1)
    }
  })

  it('un rejeu exact est stale et garde le blob actif', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await push(t, userId, { projectId: 'p', name: 'p', updatedAt: 100 }, { v: 1 })
    const active = (await project(t, userId, 'p'))!.blobId

    expect(
      (await push(t, userId, { projectId: 'p', name: 'p', updatedAt: 100 }, { v: 1 })).outcome,
    ).toBe('stale')
    expect((await project(t, userId, 'p'))!.blobId).toBe(active)
    expect(await stored(t, active)).toBe(true)
    expect(await storageCount(t)).toBe(1)
  })

  it('une version plus ancienne nettoie son nouveau blob', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await push(t, userId, { projectId: 'p', name: 'récent', updatedAt: 200 }, { v: 2 })
    expect(
      (await push(t, userId, { projectId: 'p', name: 'ancien', updatedAt: 100 }, { v: 1 })).outcome,
    ).toBe('stale')
    expect(await storageCount(t)).toBe(1)
  })

  it('un remplacement supprime l’ancien blob après le commit', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await push(t, userId, { projectId: 'p', name: 'un', updatedAt: 100 }, { v: 1 })
    const first = (await project(t, userId, 'p'))!.blobId
    await push(t, userId, { projectId: 'p', name: 'deux', updatedAt: 200 }, { v: 2 })
    const second = (await project(t, userId, 'p'))!.blobId
    expect(await stored(t, first)).toBe(false)
    expect(await stored(t, second)).toBe(true)
  })
})

describe('quotas de stockage projet', () => {
  it('borne le nombre de projets, y compris deux créations concurrentes, puis libère la place', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const candidates = await t.run(async (ctx) => {
      const blobId = await ctx.storage.store(new Blob(['x'], { type: 'application/json' }))
      for (let index = 0; index < MAX_PROJECTS_PER_ACCOUNT - 1; index += 1) {
        await ctx.db.insert('projects', {
          userId,
          projectId: `seed-${index}`,
          name: `seed-${index}`,
          updatedAt: 1,
          blobId,
          byteLength: 1,
        })
      }
      return await Promise.all([
        ctx.storage.store(new Blob(['a'], { type: 'application/json' })),
        ctx.storage.store(new Blob(['b'], { type: 'application/json' })),
      ])
    })

    const concurrent = await Promise.allSettled(
      ['a', 'b'].map((projectId, index) =>
        t.withIdentity({ subject: userId }).mutation(internal.projects.commitProjectUpload, {
          projectId,
          name: projectId,
          updatedAt: 1,
          blobId: candidates[index]!,
        }),
      ),
    )
    expect(
      concurrent.filter((result) => result.status === 'fulfilled' && result.value === 'accepted'),
    ).toHaveLength(1)
    expect(
      concurrent.filter(
        (result) =>
          result.status === 'rejected' && errorCode(result.reason) === 'PROJECT_COUNT_LIMIT',
      ),
    ).toHaveLength(1)
    expect(await t.run((ctx) => ctx.db.query('projects').collect())).toHaveLength(
      MAX_PROJECTS_PER_ACCOUNT,
    )

    await t.withIdentity({ subject: userId }).mutation(api.projects.removeProject, {
      projectId: 'seed-0',
    })
    expect(
      (await push(t, userId, { projectId: 'c', name: 'c', updatedAt: 1 }, {})).response.status,
    ).toBe(200)
  })

  it('borne le cumul et soustrait la version remplacée', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await t.run(async (ctx) => {
      const blobId = await ctx.storage.store(new Blob(['x'], { type: 'application/json' }))
      await ctx.db.insert('projects', {
        userId,
        projectId: 'plein',
        name: 'plein',
        updatedAt: 1,
        blobId,
        byteLength: MAX_PROJECT_BYTES_PER_ACCOUNT,
      })
    })

    const blocked = await push(t, userId, { projectId: 'autre', name: 'autre', updatedAt: 1 }, {})
    expect(blocked.response.status).toBe(413)
    expect(blocked.outcome).toBe('project-storage-limit')
    expect(
      (await push(t, userId, { projectId: 'plein', name: 'plein', updatedAt: 2 }, {})).outcome,
    ).toBe('accepted')
  })
})

it('après expiration, le projet reste lisible et supprimable mais plus modifiable', async () => {
  const t = testConvex()
  const userId = await cloudAccount(t)
  await push(t, userId, { projectId: 'p', name: 'p', updatedAt: 1 }, { value: 1 })
  await t.run(async (ctx) => {
    const entitlement = await ctx.db
      .query('entitlements')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    await ctx.db.patch(entitlement!._id, {
      cloudStatus: 'canceled',
      cloudPeriodEnd: '2020-01-01T00:00:00.000Z',
    })
  })

  expect((await t.withIdentity({ subject: userId }).fetch('/project-blob/p')).status).toBe(200)
  expect(
    (await push(t, userId, { projectId: 'p', name: 'p', updatedAt: 2 }, {})).response.status,
  ).toBe(403)
  await expect(
    t.withIdentity({ subject: userId }).mutation(api.projects.removeProject, { projectId: 'p' }),
  ).resolves.toBe(true)
})

describe('références historiques aliasées', () => {
  it('conserve un fichier partagé jusqu’au dernier remplacement, même entre comptes et tables', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    const shared = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(['partagé'], { type: 'image/png' }))
      await ctx.db.insert('projects', {
        userId: owner,
        projectId: 'p',
        name: 'p',
        updatedAt: 1,
        blobId: id,
        byteLength: 8,
      })
      await ctx.db.insert('assets', {
        userId: other,
        assetId: 'a',
        storageId: id,
        contentType: 'image/png',
        byteLength: 7,
      })
      return id
    })

    await push(t, owner, { projectId: 'p', name: 'p2', updatedAt: 2 }, { v: 2 })
    expect(await stored(t, shared)).toBe(true)
    expect((await pushAsset(t, other, 'a', new Uint8Array([1, 2, 3]))).status).toBe(200)
    expect(await stored(t, shared)).toBe(false)
  })

  it('une suppression ne casse pas le projet aliasé d’un autre compte', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    const shared = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(['partagé'], { type: 'application/json' }))
      await ctx.db.insert('projects', {
        userId: owner,
        projectId: 'a',
        name: 'a',
        updatedAt: 1,
        blobId: id,
        byteLength: 8,
      })
      await ctx.db.insert('projects', {
        userId: other,
        projectId: 'b',
        name: 'b',
        updatedAt: 1,
        blobId: id,
        byteLength: 8,
      })
      return id
    })

    await t
      .withIdentity({ subject: owner })
      .mutation(api.projects.removeProject, { projectId: 'a' })
    expect(await stored(t, shared)).toBe(true)
    expect((await t.withIdentity({ subject: other }).fetch('/project-blob/b')).status).toBe(200)
    await t
      .withIdentity({ subject: other })
      .mutation(api.projects.removeProject, { projectId: 'b' })
    expect(await stored(t, shared)).toBe(false)
  })

  it('un paramètre blobId hostile est ignoré et ne rattache pas les octets de la victime', async () => {
    const t = testConvex()
    const victim = await cloudAccount(t)
    const attacker = await cloudAccount(t)
    await push(
      t,
      victim,
      { projectId: 'secret', name: 'secret', updatedAt: 1 },
      { owner: 'victim' },
    )
    const victimBlob = (await project(t, victim, 'secret'))!.blobId
    const query = new URLSearchParams({
      projectId: 'vol',
      name: 'vol',
      updatedAt: '1',
      blobId: victimBlob,
    })
    const response = await t.withIdentity({ subject: attacker }).fetch(`/upload/project?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: 'attacker' }),
    })
    expect(response.status).toBe(200)
    expect(
      await (await t.withIdentity({ subject: attacker }).fetch('/project-blob/vol')).json(),
    ).toEqual({
      owner: 'attacker',
    })
    expect(await stored(t, victimBlob)).toBe(true)
  })
})
