import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { honest } from './assets'
import { MAX_IMAGE_FILE_BYTES } from './media'
import { cloudAccount, errorCode, testConvex } from './test.helpers'

/**
 * Le plafond de téléversement est du code, donc il se teste comme du code.
 *
 * Convex n'applique rien à la réception : l'URL rendue par `generateUploadUrl`
 * accepte n'importe quel octet, de n'importe quel type. Le plafond tient donc
 * en deux contrôles — un avant (refuser une intention absurde sans dépenser
 * d'URL) et un après (relire les métadonnées réelles et supprimer le menteur).
 *
 * Le second n'est jouable qu'à moitié dans `convex-test` : son `_storage` ne
 * porte que `size` et `sha256`, jamais le `contentType` qu'un vrai déploiement
 * enregistre depuis l'en-tête du POST. Le refus passe donc par la mutation, et
 * l'acceptation par la règle elle-même, `honest`.
 */

const PNG = 'image/png'

/** Un asset déjà confirmé, posé sans passer par la mutation. */
async function seedAsset(
  t: ReturnType<typeof testConvex>,
  userId: Id<'users'>,
  assetId: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType = PNG,
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }))
    await ctx.db.insert('assets', {
      userId,
      assetId,
      storageId,
      contentType,
      byteLength: bytes.byteLength,
    })
    return storageId
  })
}

describe('ce qu’on accepte de recevoir', () => {
  it('refuse 17 MiB avant même de rendre une URL', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const trop = await t
      .withIdentity({ subject: userId })
      .mutation(api.assets.requestAssetUpload, {
        assetId: 'a',
        contentType: PNG,
        byteLength: 17 * 1024 * 1024,
      })
      .then(() => 'ok')
      .catch((error: unknown) => errorCode(error))
    expect(trop).toBe('ASSET_REJECTED')
  })

  it('accepte 16 MiB — le contre-test du précédent', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const url = await t.withIdentity({ subject: userId }).mutation(api.assets.requestAssetUpload, {
      assetId: 'a',
      contentType: PNG,
      byteLength: MAX_IMAGE_FILE_BYTES,
    })
    expect(url).toMatch(/^https?:\/\//)
  })

  it('refuse un type que l’éditeur ne sait pas poser', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const refusé = await t
      .withIdentity({ subject: userId })
      .mutation(api.assets.requestAssetUpload, {
        assetId: 'a',
        contentType: 'application/pdf',
        byteLength: 1024,
      })
      .then(() => 'ok')
      .catch((error: unknown) => errorCode(error))
    expect(refusé).toBe('ASSET_REJECTED')
  })

  it('refuse un fichier vide', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const vide = await t
      .withIdentity({ subject: userId })
      .mutation(api.assets.requestAssetUpload, { assetId: 'a', contentType: PNG, byteLength: 0 })
      .then(() => 'ok')
      .catch((error: unknown) => errorCode(error))
    expect(vide).toBe('ASSET_REJECTED')
  })
})

describe('ce que le fichier déposé dit vraiment', () => {
  it('supprime et n’enregistre pas un fichier dont le type ment', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(64)], { type: 'application/pdf' })),
    )

    const confirmé = await t
      .withIdentity({ subject: userId })
      .mutation(api.assets.confirmAssetUpload, {
        assetId: 'a',
        storageId,
        contentType: PNG,
        byteLength: 64,
      })

    expect(confirmé).toBe(false)
    /* La suppression tient parce que la mutation n'a pas levé. Avec un `throw`
       à la place, la transaction annulait le `storage.delete` et le fichier
       refusé restait stocké — mesuré, pas supposé. */
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('assets').collect())).toEqual([])
  })

  it('supprime aussi un fichier plus gros que ce qui avait été annoncé', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(4096)], { type: PNG })),
    )

    const confirmé = await t
      .withIdentity({ subject: userId })
      .mutation(api.assets.confirmAssetUpload, {
        assetId: 'a',
        storageId,
        contentType: PNG,
        byteLength: 64,
      })

    expect(confirmé).toBe(false)
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull()
  })

  it('laisse passer un fichier qui dit la vérité', () => {
    /* Le contre-test des deux précédents, sur la règle seule : sans lui, un
       `honest` qui rendrait toujours `false` passerait toute cette suite. */
    expect(honest({ contentType: PNG, size: 64 }, { contentType: PNG, byteLength: 64 })).toBe(true)
  })

  it('refuse un fichier introuvable, sans type, ou trop gros bien qu’honnête', () => {
    expect(honest(null, { contentType: PNG, byteLength: 64 })).toBe(false)
    expect(honest({ size: 64 }, { contentType: PNG, byteLength: 64 })).toBe(false)
    expect(
      honest(
        { contentType: PNG, size: MAX_IMAGE_FILE_BYTES + 1 },
        { contentType: PNG, byteLength: MAX_IMAGE_FILE_BYTES + 1 },
      ),
    ).toBe(false)
  })
})

describe('la lecture des binaires', () => {
  it('rend 16 MiB entiers, avec leur type', async () => {
    /* Le plafond de réponse d'une `httpAction` est de 20 MiB pour un import
       plafonné à 16 : la marge est réelle mais mince, et rien d'autre dans la
       suite ne fait passer un fichier de cette taille par la route. */
    const t = testConvex()
    const userId = await cloudAccount(t)
    const bytes = new Uint8Array(MAX_IMAGE_FILE_BYTES)
    bytes[0] = 137
    bytes[bytes.length - 1] = 42
    await seedAsset(t, userId, 'gros', bytes)

    const response = await t.withIdentity({ subject: userId }).fetch('/asset/gros')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(PNG)
    const received = new Uint8Array(await response.arrayBuffer())
    expect(received.byteLength).toBe(MAX_IMAGE_FILE_BYTES)
    expect(received[0]).toBe(137)
    expect(received[received.length - 1]).toBe(42)
  })

  it('rend 404 sur l’asset d’un autre compte, jamais 403', async () => {
    /* 403 confirmerait l'existence, et l'existence est elle-même privée : ce
       qui est déposé ici est la capture d'écran d'une app non annoncée. */
    const t = testConvex()
    const propriétaire = await cloudAccount(t)
    const curieux = await cloudAccount(t)
    await seedAsset(t, propriétaire, 'privé', new Uint8Array(32))

    const volé = await t.withIdentity({ subject: curieux }).fetch('/asset/privé')
    const inexistant = await t.withIdentity({ subject: curieux }).fetch('/asset/jamais-vu')
    expect(volé.status).toBe(404)
    /* Les deux réponses sont indistinguables — c'est la propriété, pas le code. */
    expect(inexistant.status).toBe(volé.status)
  })

  it('rend 404 sans session', async () => {
    const t = testConvex()
    const propriétaire = await cloudAccount(t)
    await seedAsset(t, propriétaire, 'privé', new Uint8Array(32))
    expect((await t.fetch('/asset/privé')).status).toBe(404)
  })
})
