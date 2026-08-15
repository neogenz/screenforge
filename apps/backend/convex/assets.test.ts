import { describe, expect, it } from 'vitest'
import type { Id } from './_generated/dataModel'
import { acceptable } from './assets'
import { MAX_IMAGE_FILE_BYTES } from './media'
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
    const bytes = new Uint8Array(MAX_IMAGE_FILE_BYTES)
    bytes[0] = 137
    bytes[bytes.length - 1] = 42

    const result = await upload(t, userId, 'gros', new Blob([bytes], { type: PNG }))
    expect(result.response.status).toBe(200)
    expect(result.body.outcome).toBe('accepted')

    const response = await t.withIdentity({ subject: userId }).fetch('/asset/gros')
    expect(response.headers.get('Content-Type')).toBe(PNG)
    const received = new Uint8Array(await response.arrayBuffer())
    expect(received.byteLength).toBe(MAX_IMAGE_FILE_BYTES)
    expect(received[0]).toBe(137)
    expect(received[received.length - 1]).toBe(42)
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
    await upload(t, userId, 'a', new Blob(['un'], { type: PNG }))
    const first = (await asset(t, userId, 'a'))!.storageId
    await upload(t, userId, 'a', new Blob(['deux'], { type: PNG }))
    const second = (await asset(t, userId, 'a'))!.storageId
    expect(await stored(t, first)).toBe(false)
    expect(await stored(t, second)).toBe(true)
  })

  it('ignore un storageId hostile et stocke les octets réellement reçus', async () => {
    const t = testConvex()
    const victim = await cloudAccount(t)
    const attacker = await cloudAccount(t)
    await upload(t, victim, 'secret', new Blob(['victime'], { type: PNG }))
    const victimStorage = (await asset(t, victim, 'secret'))!.storageId

    const result = await upload(t, attacker, 'vol', new Blob(['attaquant'], { type: PNG }), {
      storageId: victimStorage,
    })
    expect(result.response.status).toBe(200)
    expect(await (await t.withIdentity({ subject: attacker }).fetch('/asset/vol')).text()).toBe(
      'attaquant',
    )
    expect(await (await t.withIdentity({ subject: victim }).fetch('/asset/secret')).text()).toBe(
      'victime',
    )
    expect(await stored(t, victimStorage)).toBe(true)
  })

  it('rend 404 sur l’asset d’un autre compte et sans session', async () => {
    const t = testConvex()
    const owner = await cloudAccount(t)
    const other = await cloudAccount(t)
    await upload(t, owner, 'privé', new Blob(['secret'], { type: PNG }))
    expect((await t.withIdentity({ subject: other }).fetch('/asset/privé')).status).toBe(404)
    expect((await t.fetch('/asset/privé')).status).toBe(404)
  })
})

describe('CORS exact sans autorité ambiante', () => {
  it('reflète seulement une origine configurée et garde les clients serveur utilisables', async () => {
    const previous = process.env.CORS_ALLOWED_ORIGINS
    process.env.CORS_ALLOWED_ORIGINS = 'https://preview.screenforge.app,https://screenforge.app'
    try {
      const t = testConvex()
      const userId = await cloudAccount(t)
      await upload(t, userId, 'cors', new Blob(['octets'], { type: PNG }))

      const allowed = await t.withIdentity({ subject: userId }).fetch('/asset/cors', {
        headers: { Origin: 'https://screenforge.app' },
      })
      expect(allowed.status).toBe(200)
      expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://screenforge.app')
      expect(allowed.headers.get('Vary')).toBe('Origin')

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
    }
  })
})
