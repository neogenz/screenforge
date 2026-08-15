import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { readEntitlements, requireCloud, requireUser } from './authz'
import { errorCode, testConvex } from './test.helpers'

/**
 * Le mur, du point de vue de quelqu'un qui essaie de passer.
 *
 * L'autorisation **est** la fonction : il n'y a pas de moteur tiers à
 * configurer à côté, donc un test qui passe prouve la règle elle-même et non le
 * réglage qui l'entoure.
 *
 * Chaque refus est accompagné de son contre-test. Une règle qui refuserait tout
 * passerait sinon une suite entière de refus tout en cassant le produit.
 */

const NOW = new Date('2026-08-08T00:00:00.000Z')

type Mirror = {
  licenceGrantedAt?: string | null
  cloudStatus?: string | null
  cloudPeriodEnd?: string | null
}

/** Un compte, et l'état de son miroir. Sans miroir, c'est un compte gratuit. */
async function account(t: ReturnType<typeof testConvex>, mirror?: Mirror) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {})
    if (mirror) {
      await ctx.db.insert('entitlements', {
        userId,
        polarCustomerId: 'cus_1',
        licenceGrantedAt: mirror.licenceGrantedAt ?? null,
        cloudStatus: mirror.cloudStatus ?? null,
        cloudPeriodEnd: mirror.cloudPeriodEnd ?? null,
        sourceUpdatedAt: null,
      })
    }
    return userId
  })
}

/** Ce que `requireCloud` répond à ce compte-là, refus compris. */
async function gate(
  t: ReturnType<typeof testConvex>,
  userId: Id<'users'> | null,
): Promise<'ok' | string | null> {
  const as = userId === null ? t : t.withIdentity({ subject: userId })
  return await as.run(async (ctx) => {
    try {
      await requireCloud(ctx, NOW)
      return 'ok'
    } catch (error) {
      return errorCode(error)
    }
  })
}

describe('sans session', () => {
  it('refuse toute écriture', async () => {
    const t = testConvex()
    expect(await gate(t, null)).toBe('UNAUTHENTICATED')
  })

  it('refuse aussi la simple identification', async () => {
    const t = testConvex()
    const code = await t.run(async (ctx) => {
      try {
        await requireUser(ctx)
        return 'ok'
      } catch (error) {
        return errorCode(error)
      }
    })
    expect(code).toBe('UNAUTHENTICATED')
  })

  it('rend `null` sur la lecture des droits, et pas une erreur', async () => {
    /* `null` veut dire « la question ne se pose pas », jamais « aucun droit » :
       l'éditeur distingue les deux pour ne pas afficher un filigrane à
       quelqu'un dont il n'a pas encore restauré la session. */
    const t = testConvex()
    expect(await t.query(api.mirror.myEntitlements, { now: NOW.getTime() })).toBeNull()
  })
})

describe('le portillon du Cloud', () => {
  it('refuse un compte qui n’a rien acheté', async () => {
    const t = testConvex()
    expect(await gate(t, await account(t))).toBe('CLOUD_REQUIRED')
  })

  it('refuse la Licence seule — le Cloud est un droit à part', async () => {
    const t = testConvex()
    const userId = await account(t, { licenceGrantedAt: '2026-03-12T09:00:00.000Z' })
    expect(await gate(t, userId)).toBe('CLOUD_REQUIRED')
  })

  it('laisse passer un abonnement en cours', async () => {
    /* Le contre-test : sans lui, un portillon qui refuserait tout le monde
       passerait les deux cas précédents. */
    const t = testConvex()
    const userId = await account(t, {
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'active',
      cloudPeriodEnd: '2027-03-12T09:00:00.000Z',
    })
    expect(await gate(t, userId)).toBe('ok')
  })

  it('laisse passer une résiliation dont la période court encore', async () => {
    /* L'utilisateur a payé l'année, il l'a jusqu'au bout. */
    const t = testConvex()
    const userId = await account(t, {
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'canceled',
      cloudPeriodEnd: '2026-11-01T00:00:00.000Z',
    })
    expect(await gate(t, userId)).toBe('ok')
  })

  it('refuse une période terminée, sans toucher à la Licence', async () => {
    const t = testConvex()
    const userId = await account(t, {
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'canceled',
      cloudPeriodEnd: '2026-07-01T00:00:00.000Z',
    })
    expect(await gate(t, userId)).toBe('CLOUD_REQUIRED')

    const rights = await t
      .withIdentity({ subject: userId })
      .run((ctx) => readEntitlements(ctx, userId, NOW))
    /* Ce que la fin de période n'emporte pas : l'achat unique. Le confondre
       avec l'abonnement retirerait l'export propre à quelqu'un qui l'a payé. */
    expect(rights.licence).toBe(true)
    expect(rights.cloud).toBe(false)
  })

  it('laisse passer le Cloud autonome sans achat Local', async () => {
    const t = testConvex()
    const userId = await account(t, {
      cloudStatus: 'active',
      cloudPeriodEnd: '2027-03-12T09:00:00.000Z',
    })
    expect(await gate(t, userId)).toBe('ok')
  })
})

describe('ce qui reste ouvert quand le droit s’éteint', () => {
  it('lire ses droits reste possible sans droit Cloud', async () => {
    /* « Un abonnement qui se termine ne doit emporter aucune donnée. » Fermer
       la lecture transformerait une fin de période en perte apparente. */
    const t = testConvex()
    const userId = await account(t, { licenceGrantedAt: '2026-03-12T09:00:00.000Z' })
    const read = await t
      .withIdentity({ subject: userId })
      .query(api.mirror.myEntitlements, { now: NOW.getTime() })
    expect(read).toMatchObject({ userId, licence: true, cloud: false })
  })

  it('personne ne lit le miroir d’un autre', async () => {
    const t = testConvex()
    const victime = await account(t, { licenceGrantedAt: '2026-03-12T09:00:00.000Z' })
    const curieux = await account(t)
    const read = await t
      .withIdentity({ subject: curieux })
      .query(api.mirror.myEntitlements, { now: NOW.getTime() })
    /* La requête ne prend pas d'identifiant en argument : il n'y a pas de
       paramètre à falsifier, et c'est la forme qui le garantit. */
    expect(read?.userId).toBe(curieux)
    expect(read?.licence).toBe(false)
    expect(curieux).not.toBe(victime)
  })
})

describe('la lecture des droits date sa propre question', () => {
  it('la même ligne rend `cloud` avant l’échéance et plus après', async () => {
    /* Ce qui se casserait sans l'argument : une query Convex ne se rejoue que
       si les données qu'elle a lues changent, or la fin d'une période n'en
       change aucune. La même ligne doit donc répondre deux choses selon
       l'instant qu'on lui donne — sinon l'éditeur afficherait un droit que la
       première écriture lui refuserait. */
    const t = testConvex()
    const userId = await account(t, {
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'canceled',
      cloudPeriodEnd: '2026-09-01T00:00:00.000Z',
    })
    const as = t.withIdentity({ subject: userId })

    const pendant = await as.query(api.mirror.myEntitlements, {
      now: Date.parse('2026-08-08T00:00:00.000Z'),
    })
    const apres = await as.query(api.mirror.myEntitlements, {
      now: Date.parse('2026-09-02T00:00:00.000Z'),
    })

    expect(pendant?.cloud).toBe(true)
    expect(apres?.cloud).toBe(false)
    /* L'achat unique ne bouge pas : seule la période a expiré. */
    expect(apres?.licence).toBe(true)
  })
})
