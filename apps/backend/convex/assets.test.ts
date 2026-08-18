import { describe, expect, it } from 'vitest'
import type { Id } from './_generated/dataModel'
import { api } from './_generated/api'
import { acceptable } from './assets'
import {
  ASSET_DOWNLOADS_PER_HOUR,
  MAX_ASSET_BYTES_PER_ACCOUNT,
  MAX_ASSETS_PER_ACCOUNT,
} from './limits'
import { MAX_IMAGE_FILE_BYTES } from './media'
import { jpeg, png } from './media.test-fixtures'
import { cloudAccount, testConvex } from './test.helpers'

type Test = ReturnType<typeof testConvex>
const PNG = 'image/png'

async function upload(
  t: Test,
  userId: Id<'users'>,
  assetId: string,
  blob: Blob,
  extra: Record<string, string> = {},
) {
  const query = new URLSearchParams({ assetId, ...extra })
  const response = await t.withIdentity({ subject: userId }).fetch(`/upload/asset?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  })
  return { response, body: (await response.json()) as { outcome: string } }
}

async function asset(t: Test, userId: Id<'users'>, assetId: string) {
  return await t.run((ctx) =>
    ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId).eq('assetId', assetId))
      .unique(),
  )
}

async function stored(t: Test, storageId: Id<'_storage'>) {
  return (await t.run((ctx) => ctx.db.system.get(storageId))) !== null
}

async function storageCount(t: Test) {
  return (await t.run((ctx) => ctx.db.system.query('_storage').collect())).length
}

describe('upload asset possédé par le serveur', () => {
  it('accepte 16 MiB entiers puis les sert avec leur type', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const bytes = png(42, MAX_IMAGE_FILE_BYTES)

    const result = await upload(t, userId, 'gros', new Blob([bytes], { type: PNG }))
    expect(result.response.status).toBe(200)
    expect(result.body.outcome).toBe('accepted')

    const response = await t.withIdentity({ subject: userId }).fetch('/asset/gros')
    expect(response.headers.get('Content-Type')).toBe(PNG)
    const received = new Uint8Array(await response.arrayBuffer())
    expect(received.byteLength).toBe(MAX_IMAGE_FILE_BYTES)
    expect(received[0]).toBe(137)
    expect(received[41]).toBe(42)
  })

  it('accepte PNG JPEG et SVG réels puis refuse octets mensongers ou actifs sans orphelin', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><path d="M0 0"/></svg>'

    for (const [assetId, blob] of [
      ['png', new Blob([png()], { type: PNG })],
      ['jpeg', new Blob([jpeg()], { type: 'image/jpeg' })],
      ['svg', new Blob([safeSvg], { type: 'image/svg+xml' })],
    ] as const) {
      expect((await upload(t, userId, assetId, blob)).response.status).toBe(200)
    }
    expect(await storageCount(t)).toBe(3)

    for (const [assetId, blob] of [
      ['mismatch', new Blob([jpeg()], { type: PNG })],
      ['truncated', new Blob([png().subarray(0, 20)], { type: PNG })],
      [
        'script',
        new Blob(['<svg width="1" height="1"><script>alert(1)</script></svg>'], {
          type: 'image/svg+xml',
        }),
      ],
      [
        'external',
        new Blob(['<svg width="1" height="1"><use href="https://evil.test/a"/></svg>'], {
          type: 'image/svg+xml',
        }),
      ],
    ] as const) {
      expect((await upload(t, userId, assetId, blob)).response.status).toBe(400)
    }
    expect(await storageCount(t)).toBe(3)
  })

  it('refuse 17 MiB, un type inconnu et un fichier vide sans orphelin', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)

    expect(
      (await upload(t, userId, 'trop', new Blob([new Uint8Array(17 * 1024 * 1024)], { type: PNG })))
        .response.status,
    ).toBe(413)
    expect(
      (await upload(t, userId, 'pdf', new Blob(['x'], { type: 'application/pdf' }))).response
        .status,
    ).toBe(400)
    expect((await upload(t, userId, 'vide', new Blob([], { type: PNG }))).response.status).toBe(400)
    expect(await storageCount(t)).toBe(0)
    expect(await t.run((ctx) => ctx.db.query('assets').collect())).toEqual([])
  })

  it('refuse sans session avant de lire ou stocker', async () => {
    const t = testConvex()
    const response = await t.fetch('/upload/asset?assetId=a', {
      method: 'POST',
      headers: { 'Content-Type': PNG },
      body: new Blob(['x'], { type: PNG }),
    })
    expect(response.status).toBe(401)
    expect(await storageCount(t)).toBe(0)
  })

  it('la règle accepte uniquement les types et tailles du produit', () => {
    expect(acceptable(PNG, MAX_IMAGE_FILE_BYTES)).toBe(true)
    expect(acceptable(PNG, 0)).toBe(false)
    expect(acceptable(PNG, MAX_IMAGE_FILE_BYTES + 1)).toBe(false)
    expect(acceptable('application/pdf', 1)).toBe(false)
  })
})

describe('remplacement et isolation', () => {
  it('remplace un asset et supprime son ancien fichier', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await upload(t, userId, 'a', new Blob([png(1)], { type: PNG }))
    const first = (await asset(t, userId, 'a'))!.storageId
    await upload(t, userId, 'a', new Blob([png(2)], { type: PNG }))
    const second = (await asset(t, userId, 'a'))!.storageId
    expect(await stored(t, first)).toBe(false)
    expect(await stored(t, second)).toBe(true)
  })

  it('ignore un storageId hostile et stocke les octets réellement reçus', async () => {
    const t = testConvex()
    const victim = await cloudAccount(t)
    const attacker = await cloudAccount(t)
    const victimBytes = png(3)
    const attackerBytes = png(4)
    await upload(t, victim, 'secret', new Blob([victimBytes], { type: PNG }))
    const victimStorage = (await asset(t, victim, 'secret'))!.storageId

    const result = await upload(t, attacker, 'vol', new Blob([attackerBytes], { type: PNG }), {
      storageId: victimStorage,
    })
    expect(result.response.status).toBe(200)
    expect(
      new Uint8Array(
        await (await t.withIdentity({ subject: attacker }).fetch('/asset/vol')).arrayBuffer(),
      ),
    ).toEqual(attackerBytes)
    expect(
      new Uint8Array(
        await (await t.withIdentity({ subject: victim }).fetch('/asset/secret')).arrayBuffer(),
      ),
    ).toEqual(victimBytes)
    expect(await stored(t, victimStorage)).toBe(true)
  })

  it('rend 404 sur l’asset d’un autre compte et sans session', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    await upload(t, owner, 'privé', new Blob([png()], { type: PNG }))
    expect((await t.withIdentity({ subject: other }).fetch('/asset/privé')).status).toBe(404)
    expect((await t.fetch('/asset/privé')).status).toBe(404)
  })
})

it('borne les téléchargements du propriétaire sans consommer le budget des autres', async () => {
  const t = testConvex()
  const owner = await cloudAccount(t)
  const other = await cloudAccount(t)
  await upload(t, owner, 'a', new Blob([png()], { type: PNG }))
  await upload(t, other, 'b', new Blob([png(1)], { type: PNG }))

  expect((await t.withIdentity({ subject: other }).fetch('/asset/a')).status).toBe(404)
  for (let count = 0; count < ASSET_DOWNLOADS_PER_HOUR; count += 1) {
    expect((await t.withIdentity({ subject: owner }).fetch('/asset/a')).status).toBe(200)
  }
  expect((await t.withIdentity({ subject: owner }).fetch('/asset/a')).status).toBe(429)
  expect((await t.withIdentity({ subject: other }).fetch('/asset/b')).status).toBe(200)
})

describe('quotas de stockage asset', () => {
  it('borne le nombre puis permet une création après suppression', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['x'], { type: PNG }))
      for (let index = 0; index < MAX_ASSETS_PER_ACCOUNT; index += 1) {
        await ctx.db.insert('assets', {
          userId,
          assetId: `seed-${index}`,
          storageId,
          contentType: PNG,
          byteLength: 1,
        })
      }
    })

    const blocked = await upload(t, userId, 'nouveau', new Blob([png()], { type: PNG }))
    expect(blocked.response.status).toBe(409)
    expect(blocked.body.outcome).toBe('asset-count-limit')
    await t.withIdentity({ subject: userId }).mutation(api.assets.removeAsset, {
      assetId: 'seed-0',
    })
    expect(
      (await upload(t, userId, 'nouveau', new Blob([png()], { type: PNG }))).response.status,
    ).toBe(200)
  })

  it('borne le cumul et soustrait l’asset remplacé', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['x'], { type: PNG }))
      await ctx.db.insert('assets', {
        userId,
        assetId: 'plein',
        storageId,
        contentType: PNG,
        byteLength: MAX_ASSET_BYTES_PER_ACCOUNT,
      })
    })

    const blocked = await upload(t, userId, 'autre', new Blob([png()], { type: PNG }))
    expect(blocked.response.status).toBe(413)
    expect(blocked.body.outcome).toBe('asset-storage-limit')
    expect((await upload(t, userId, 'plein', new Blob([png()], { type: PNG }))).body.outcome).toBe(
      'accepted',
    )
  })
})

it('après expiration, l’asset reste lisible et supprimable mais plus modifiable', async () => {
  const t = testConvex()
  const userId = await cloudAccount(t)
  await upload(t, userId, 'a', new Blob([png()], { type: PNG }))
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

  expect((await t.withIdentity({ subject: userId }).fetch('/asset/a')).status).toBe(200)
  expect((await upload(t, userId, 'a', new Blob([png(1)], { type: PNG }))).response.status).toBe(
    403,
  )
  await expect(
    t.withIdentity({ subject: userId }).mutation(api.assets.removeAsset, { assetId: 'a' }),
  ).resolves.toBe(true)
})

describe('CORS exact sans autorité ambiante', () => {
  it('reflète seulement une origine configurée et garde les clients serveur utilisables', async () => {
    const previous = process.env.CORS_ALLOWED_ORIGINS
    const previousPreview = process.env.VERCEL_PREVIEW_HOST_SUFFIX
    process.env.CORS_ALLOWED_ORIGINS = 'https://preview.screenforge.app,https://screenforge.app'
    process.env.VERCEL_PREVIEW_HOST_SUFFIX = '-team-123.vercel.app'
    try {
      const t = testConvex()
      const userId = await cloudAccount(t)
      await upload(t, userId, 'cors', new Blob([png()], { type: PNG }))

      const allowed = await t.withIdentity({ subject: userId }).fetch('/asset/cors', {
        headers: { Origin: 'https://screenforge.app' },
      })
      expect(allowed.status).toBe(200)
      expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://screenforge.app')
      expect(allowed.headers.get('Vary')).toBe('Origin')

      const preview = await t.withIdentity({ subject: userId }).fetch('/asset/cors', {
        headers: { Origin: 'https://screenforge-git-branch-team-123.vercel.app' },
      })
      expect(preview.status).toBe(200)
      expect(preview.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://screenforge-git-branch-team-123.vercel.app',
      )

      for (const origin of ['https://hostile.example', 'null']) {
        const rejected = await t.withIdentity({ subject: userId }).fetch('/asset/cors', {
          headers: { Origin: origin },
        })
        expect(rejected.status).toBe(403)
        expect(rejected.headers.get('Access-Control-Allow-Origin')).toBeNull()
      }

      const serverClient = await t.withIdentity({ subject: userId }).fetch('/asset/cors')
      expect(serverClient.status).toBe(200)
      expect(serverClient.headers.get('Access-Control-Allow-Origin')).toBeNull()

      process.env.CORS_ALLOWED_ORIGINS = 'https://screenforge.app/path'
      const misconfigured = await t.fetch('/asset/cors', {
        method: 'OPTIONS',
        headers: { Origin: 'https://screenforge.app' },
      })
      expect(misconfigured.status).toBe(403)
      expect(misconfigured.headers.get('Access-Control-Allow-Origin')).toBeNull()
    } finally {
      if (previous === undefined) delete process.env.CORS_ALLOWED_ORIGINS
      else process.env.CORS_ALLOWED_ORIGINS = previous
      if (previousPreview === undefined) delete process.env.VERCEL_PREVIEW_HOST_SUFFIX
      else process.env.VERCEL_PREVIEW_HOST_SUFFIX = previousPreview
    }
  })
})
