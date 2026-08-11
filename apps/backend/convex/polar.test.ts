import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { cloudAccount, errorCode, rateLimited, testConvex } from './test.helpers'

/**
 * Le contrôle d'avant-paiement, et le compteur qui le précède.
 *
 * Ce qui est vérifié ici n'est pas qu'une erreur s'affiche, mais qu'**aucune
 * session Polar n'est créée** quand le Cloud est demandé sans Licence : une
 * session ouverte est une page de paiement qu'un client peut aller au bout de
 * remplir, et le miroir refuserait ensuite le droit qu'il vient de payer.
 *
 * Le SDK est remplacé, et lui seul. Tout le reste — l'identité, le compteur, la
 * lecture du miroir — est le vrai code du déploiement : appeler Polar depuis une
 * suite de tests créerait des objets chez un tiers à chaque exécution.
 */
const polarClient = vi.hoisted(() => ({
  checkouts: {
    create: vi.fn(() => Promise.resolve({ url: 'https://sandbox.polar.sh/checkout/abc' })),
  },
  customerSessions: {
    create: vi.fn(() =>
      Promise.resolve({ customerPortalUrl: 'https://sandbox.polar.sh/portal/abc' }),
    ),
  },
}))

vi.mock('@polar-sh/sdk', () => ({
  /* Une classe, parce que `polar.ts` fait `new Polar(…)` : une fonction fléchée
     n'est pas un constructeur. */
  Polar: class {
    checkouts = polarClient.checkouts
    customerSessions = polarClient.customerSessions
  },
}))

process.env.POLAR_ACCESS_TOKEN = 'polar_at_test'
process.env.POLAR_WEBHOOK_SECRET = 'whsec_screenforge_test'
process.env.POLAR_LICENCE_PRODUCT_ID = 'prod_licence'
process.env.POLAR_CLOUD_PRODUCT_ID = 'prod_cloud'
process.env.POLAR_LICENCE_BENEFIT_ID = 'ben_licence'
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

type Stack = ReturnType<typeof testConvex>

/** Un compte sans aucun achat : le cas de qui vient acheter la Licence. */
async function newcomer(t: Stack): Promise<Id<'users'>> {
  return await t.run((ctx) => ctx.db.insert('users', {}))
}

function checkout(t: Stack, userId: Id<'users'> | null, product: 'licence' | 'cloud') {
  const caller = userId === null ? t : t.withIdentity({ subject: userId })
  return caller.action(api.polar.createCheckout, { product })
}

let t: Stack

beforeEach(() => {
  t = testConvex()
  vi.clearAllMocks()
})

describe('createCheckout', () => {
  it('ouvre un checkout pour la Licence', async () => {
    const userId = await newcomer(t)

    await expect(checkout(t, userId, 'licence')).resolves.toEqual({
      url: 'https://sandbox.polar.sh/checkout/abc',
    })
    /* `externalCustomerId` porte l'`Id<'users'>` : c'est ce qui relie le client
       Polar au compte, et ce que le webhook relit dans l'autre sens. */
    expect(polarClient.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ products: ['prod_licence'], externalCustomerId: userId }),
    )
  })

  /* Critère 5 : refusé avant tout appel à Polar. */
  it('refuse le Cloud sans Licence, et ne crée aucune session Polar', async () => {
    const userId = await newcomer(t)

    await expect(checkout(t, userId, 'cloud')).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'LICENCE_REQUIRED',
    )
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  it('ouvre le checkout Cloud une fois la Licence détenue', async () => {
    const userId = await cloudAccount(t)

    await expect(checkout(t, userId, 'cloud')).resolves.toMatchObject({ url: expect.any(String) })
    expect(polarClient.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ products: ['prod_cloud'] }),
    )
  })

  it('refuse sans session, et ne touche pas à Polar', async () => {
    await expect(checkout(t, null, 'licence')).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  /* Critère 6 : le onzième checkout de l'heure est refusé. Le code voyage, la
     phrase affichée appartient à l'éditeur. */
  it('refuse le onzième checkout de l’heure', async () => {
    const userId = await newcomer(t)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await checkout(t, userId, 'licence')
    }

    await expect(checkout(t, userId, 'licence')).rejects.toSatisfy(rateLimited)
    expect(polarClient.checkouts.create).toHaveBeenCalledTimes(10)
  })

  it('compte par compte, pas globalement', async () => {
    /* Le contre-test : un compteur sans clé fermerait la vente à tout le monde
       dès qu'un seul compte l'atteint. */
    const bavard = await newcomer(t)
    const autre = await newcomer(t)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await checkout(t, bavard, 'licence')
    }

    await expect(checkout(t, autre, 'licence')).resolves.toMatchObject({ url: expect.any(String) })
  })
})

describe('createPortalSession', () => {
  it('ouvre le portail du titulaire de la session', async () => {
    const userId = await cloudAccount(t)

    await expect(
      t.withIdentity({ subject: userId }).action(api.polar.createPortalSession, {}),
    ).resolves.toEqual({ url: 'https://sandbox.polar.sh/portal/abc' })
    expect(polarClient.customerSessions.create).toHaveBeenCalledWith({
      externalCustomerId: userId,
    })
  })

  it('refuse sans session', async () => {
    await expect(t.action(api.polar.createPortalSession, {})).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    expect(polarClient.customerSessions.create).not.toHaveBeenCalled()
  })
})

describe('healthcheck', () => {
  it('nomme les variables manquantes plutôt que d’échouer au premier achat', async () => {
    const { internal } = await import('./_generated/api')
    await expect(t.query(internal.billing.healthcheck, {})).resolves.toEqual([])

    const secret = process.env.POLAR_WEBHOOK_SECRET
    delete process.env.POLAR_WEBHOOK_SECRET
    try {
      await expect(t.query(internal.billing.healthcheck, {})).resolves.toEqual([
        'POLAR_WEBHOOK_SECRET',
      ])
    } finally {
      process.env.POLAR_WEBHOOK_SECRET = secret
    }
  })
})
