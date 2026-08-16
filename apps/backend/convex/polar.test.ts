import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { cloudAccount, errorCode, rateLimited, testConvex } from './test.helpers'

/**
 * Les deux checkouts autonomes, et le compteur qui les précède.
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
process.env.POLAR_CLOUD_PRODUCT_ID = 'prod_cloud'
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

type Stack = ReturnType<typeof testConvex>

/** Un compte sans aucun achat : les deux offres doivent lui être accessibles. */
async function newcomer(t: Stack): Promise<Id<'users'>> {
  return await t.run((ctx) => ctx.db.insert('users', {}))
}

function checkout(t: Stack, userId: Id<'users'> | null, product: 'cloud') {
  const caller = userId === null ? t : t.withIdentity({ subject: userId })
  return caller.action(api.polar.createCheckout, { product })
}

let t: Stack

beforeEach(() => {
  t = testConvex()
  vi.clearAllMocks()
})

describe('createCheckout', () => {
  it('ouvre le checkout Cloud pour un compte neuf', async () => {
    const userId = await newcomer(t)

    await expect(checkout(t, userId, 'cloud')).resolves.toMatchObject({ url: expect.any(String) })
    expect(polarClient.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ products: ['prod_cloud'], externalCustomerId: userId }),
    )
  })

  it('refuse tout produit autre que Cloud avant Polar', async () => {
    const userId = await newcomer(t)
    await expect(
      t.withIdentity({ subject: userId }).action(api.polar.createCheckout, {
        product: 'local',
      } as never),
    ).rejects.toBeDefined()
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  it('refuse sans session, et ne touche pas à Polar', async () => {
    await expect(checkout(t, null, 'cloud')).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  /* Critère 6 : le onzième checkout de l'heure est refusé. Le code voyage, la
     phrase affichée appartient à l'éditeur. */
  it('refuse le onzième checkout de l’heure', async () => {
    const userId = await newcomer(t)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await checkout(t, userId, 'cloud')
    }

    await expect(checkout(t, userId, 'cloud')).rejects.toSatisfy(rateLimited)
    expect(polarClient.checkouts.create).toHaveBeenCalledTimes(10)
  })

  it('compte par compte, pas globalement', async () => {
    /* Le contre-test : un compteur sans clé fermerait la vente à tout le monde
       dès qu'un seul compte l'atteint. */
    const bavard = await newcomer(t)
    const autre = await newcomer(t)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await checkout(t, bavard, 'cloud')
    }

    await expect(checkout(t, autre, 'cloud')).resolves.toMatchObject({ url: expect.any(String) })
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
