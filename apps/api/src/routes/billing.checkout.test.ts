import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le contrôle d'avant-paiement.
 *
 * Ce qui est vérifié ici n'est pas qu'une erreur s'affiche, mais qu'**aucune
 * session Polar n'est créée** quand le Cloud est demandé sans Licence : une
 * session ouverte est une page de paiement qu'un client peut aller au bout de
 * remplir, et le miroir refuserait ensuite le droit qu'il vient de payer.
 */
const db = vi.hoisted(() => {
  const state = { row: null as Record<string, unknown> | null }
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: state.row, error: null }),
  }
  return { state, client: { from: () => query } }
})

/* Déclaré dans le bloc hoisté : `vi.mock` est remonté au-dessus des `const` du
   module, et sa fabrique ne peut lire que ce qui a été hoisté avec elle. */
const auth = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  user: null as { id: string; email: string | null } | null,
}))

const USER = auth.userId

const polarClient = vi.hoisted(() => ({
  checkouts: { create: vi.fn(async () => ({ url: 'https://sandbox.polar.sh/checkout/abc' })) },
  customerSessions: {
    create: vi.fn(async () => ({ customerPortalUrl: 'https://sandbox.polar.sh/portal/abc' })),
  },
}))

vi.mock('../supabase.ts', () => ({
  serviceClient: () => db.client,
  verifyToken: async () => auth.user,
}))

vi.mock('../polar.ts', () => ({
  polar: () => polarClient,
  productId: (product: string) => (product === 'licence' ? 'prod_licence' : 'prod_cloud'),
}))

process.env.SUPABASE_URL = 'http://127.0.0.1:54421'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-not-used-here'
process.env.POLAR_ACCESS_TOKEN = 'polar_at_test'
process.env.POLAR_WEBHOOK_SECRET = 'whsec_screenforge_test'
process.env.POLAR_LICENCE_PRODUCT_ID = 'prod_licence'
process.env.POLAR_CLOUD_PRODUCT_ID = 'prod_cloud'
process.env.POLAR_LICENCE_BENEFIT_ID = 'ben_licence'
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

const { app } = await import('../index.ts')

function checkout(product: string, token: string | null = 'jeton-valide') {
  return app.request('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ product }),
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

const WITH_LICENCE = {
  user_id: USER,
  polar_customer_id: 'cus_1',
  licence_granted_at: '2026-03-12T09:00:00+00:00',
  cloud_status: null,
  cloud_period_end: null,
}

beforeEach(() => {
  db.state.row = null
  auth.user = { id: USER, email: 'acheteur@example.com' }
  vi.clearAllMocks()
})

describe('POST /billing/checkout', () => {
  it('opens a checkout for the licence', async () => {
    const response = await checkout('licence')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      url: 'https://sandbox.polar.sh/checkout/abc',
    })
    /* `externalCustomerId` porte l'id Supabase : c'est ce qui relie le client
       Polar au compte, et ce que le webhook relit dans l'autre sens. */
    expect(polarClient.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ products: ['prod_licence'], externalCustomerId: USER }),
    )
  })

  /* Critère 4. */
  it('refuses the cloud without a licence, and creates no Polar session', async () => {
    const response = await checkout('cloud')

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'LICENCE_REQUIRED' })
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  it('opens the cloud checkout once the licence is held', async () => {
    db.state.row = WITH_LICENCE

    const response = await checkout('cloud')

    expect(response.status).toBe(200)
    expect(polarClient.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ products: ['prod_cloud'] }),
    )
  })

  it('rejects an unknown product before touching Polar', async () => {
    const response = await checkout('entreprise')

    expect(response.status).toBe(400)
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  /* Critère 1 : l'identité vient du jeton, jamais du corps de la requête. */
  it('answers 401 without a token', async () => {
    const response = await checkout('licence', null)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHENTICATED' })
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })

  it('answers 401 on a token Supabase does not recognize', async () => {
    auth.user = null

    const response = await checkout('licence')

    expect(response.status).toBe(401)
    expect(polarClient.checkouts.create).not.toHaveBeenCalled()
  })
})

describe('POST /billing/portal', () => {
  it('opens the customer portal for the token holder', async () => {
    const response = await app.request('/billing/portal', {
      method: 'POST',
      headers: { Authorization: 'Bearer jeton-valide' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      url: 'https://sandbox.polar.sh/portal/abc',
    })
    expect(polarClient.customerSessions.create).toHaveBeenCalledWith({ externalCustomerId: USER })
  })

  it('answers 401 without a token', async () => {
    const response = await app.request('/billing/portal', { method: 'POST' })

    expect(response.status).toBe(401)
    expect(polarClient.customerSessions.create).not.toHaveBeenCalled()
  })
})

describe('GET /me', () => {
  it('answers 401 without a token', async () => {
    expect((await app.request('/me')).status).toBe(401)
  })

  it('returns the entitlements of the token holder', async () => {
    db.state.row = WITH_LICENCE

    const response = await app.request('/me', {
      headers: { Authorization: 'Bearer jeton-valide' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      userId: USER,
      licence: true,
      cloud: false,
    })
  })

  it('returns no entitlement for an account that bought nothing', async () => {
    const response = await app.request('/me', {
      headers: { Authorization: 'Bearer jeton-valide' },
    })

    await expect(response.json()).resolves.toMatchObject({ licence: false, cloud: false })
  })
})
