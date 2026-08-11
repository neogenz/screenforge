import { describe, expect, it } from 'vitest'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { applyEntitlementsIfNewer, myEntitlements } from './mirror'
import { testConvex } from './test.helpers'

/**
 * Les écritures du miroir : ce qui remplace `apply_entitlements_if_newer` et la
 * clé `service_role` qui seule pouvait l'appeler.
 */

const LICENCE = '2026-03-12T09:00:00.000Z'

async function user(t: ReturnType<typeof testConvex>): Promise<Id<'users'>> {
  return await t.run((ctx) => ctx.db.insert('users', {}))
}

function delivery(userId: Id<'users'>, sourceUpdatedAt: number | null, cloudStatus?: string) {
  return {
    userId,
    polarCustomerId: 'cus_1',
    licenceGrantedAt: LICENCE,
    cloudStatus: cloudStatus ?? null,
    cloudPeriodEnd: cloudStatus ? '2027-03-12T09:00:00.000Z' : null,
    sourceUpdatedAt,
  }
}

async function rows(t: ReturnType<typeof testConvex>) {
  return await t.run((ctx) => ctx.db.query('entitlements').collect())
}

/**
 * Les marqueurs que Convex pose sur une fonction enregistrée.
 *
 * La conversion est nécessaire et dit quelque chose : le type d'une fonction
 * interne (`RegisteredMutation<'internal', …>`) ne déclare pas `isPublic`,
 * parce que la visibilité est déjà portée par le type. La moitié « échoue à la
 * compilation » du critère est donc tenue par le compilateur, et ce qui suit
 * tient l'autre moitié.
 */
function marks(fn: unknown): { isPublic?: boolean; isInternal?: boolean } {
  return fn as { isPublic?: boolean; isInternal?: boolean }
}

describe('applyEntitlementsIfNewer', () => {
  it('crée la ligne absente et le dit', async () => {
    const t = testConvex()
    const userId = await user(t)
    expect(await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000))).toBe(
      'written',
    )
    expect(await rows(t)).toHaveLength(1)
  })

  it('deux livraisons désordonnées laissent la ligne sur la plus récente', async () => {
    const t = testConvex()
    const userId = await user(t)

    await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 2000, 'active'))
    /* La plus ancienne arrive après : c'est exactement ce qu'un webhook rejoué
       produit, et c'est le cas que la garde existe pour couvrir. */
    expect(await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000))).toBe(
      'ignored',
    )

    const [row] = await rows(t)
    expect(row?.cloudStatus).toBe('active')
  })

  it('accepte la plus récente quand elle arrive dans l’ordre', async () => {
    /* Le contre-test : une garde qui refuserait toute mise à jour passerait le
       cas précédent tout en figeant le miroir pour toujours. */
    const t = testConvex()
    const userId = await user(t)

    await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000))
    expect(
      await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 2000, 'active')),
    ).toBe('written')

    const [row] = await rows(t)
    expect(row?.cloudStatus).toBe('active')
  })

  it('ne fait rien, et le dit, quand la livraison porte la même date', async () => {
    const t = testConvex()
    const userId = await user(t)
    await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000))
    expect(await t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000))).toBe(
      'unchanged',
    )
  })

  it('deux livraisons sur un compte sans ligne n’en créent qu’une', async () => {
    /* L'unicité que la clé primaire Postgres donnait gratuitement. Convex ne
       laisse pas choisir la clé du document, donc elle est tenue par
       l'écriture — et c'est ce test qui le vérifie. */
    const t = testConvex()
    const userId = await user(t)
    await Promise.all([
      t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 1000)),
      t.mutation(internal.mirror.applyEntitlementsIfNewer, delivery(userId, 2000, 'active')),
    ])
    expect(await rows(t)).toHaveLength(1)
  })

  it('ne s’adresse pas depuis un client', () => {
    /* Ce que la clé `service_role` faisait, en mieux : il n'y a aucun secret à
       ne pas divulguer, la fonction n'est simplement pas dans la surface
       publique. `internal.` la trouve, `api.` ne la trouve pas — et le
       compilateur refuse déjà `api.mirror.applyEntitlementsIfNewer`. */
    expect(marks(applyEntitlementsIfNewer).isInternal).toBe(true)
    expect(marks(applyEntitlementsIfNewer).isPublic).toBeUndefined()
    /* Et le contre-test : la lecture, elle, est bien publique. Sans lui, un
       marqueur jamais posé passerait cette assertion en fermant toute l'API. */
    expect(marks(myEntitlements).isPublic).toBe(true)
    expect(marks(myEntitlements).isInternal).toBeUndefined()
  })
})
