import { Webhook } from 'standardwebhooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le webhook de bout en bout : signature réelle, analyse réelle du SDK Polar,
 * projection réelle. Seul Postgres est remplacé — par une ligne en mémoire, ce
 * qui suffit puisque l'idempotence se joue sur « écrire ou ne pas écrire », pas
 * sur ce que la base fait de l'écriture.
 */
const db = vi.hoisted(() => {
  const state = { row: null as Record<string, unknown> | null, writes: 0 }
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: state.row, error: null }),
  }
  const client = {
    from: () => ({
      ...query,
      upsert: async (row: Record<string, unknown>) => {
        state.writes += 1
        state.row = { ...row }
        return { error: null }
      },
    }),
  }
  return { state, client }
})

vi.mock('../supabase.ts', () => ({ serviceClient: () => db.client }))

const SECRET = 'whsec_screenforge_test'
const USER = '11111111-1111-4111-8111-111111111111'
const LICENCE_BENEFIT = 'ben_licence'
const CLOUD_PRODUCT = 'prod_cloud'

process.env.SUPABASE_URL = 'http://127.0.0.1:54421'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-not-used-here'
process.env.POLAR_ACCESS_TOKEN = 'polar_at_test'
process.env.POLAR_WEBHOOK_SECRET = SECRET
process.env.POLAR_LICENCE_PRODUCT_ID = 'prod_licence'
process.env.POLAR_CLOUD_PRODUCT_ID = CLOUD_PRODUCT
process.env.POLAR_LICENCE_BENEFIT_ID = LICENCE_BENEFIT
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

const { app } = await import('../index.ts')

interface Fixture {
  externalId?: string | null
  licenceGrantedAt?: string | null
  cloud?: { status: string; currentPeriodEnd: string; endsAt: string | null } | null
}

/** Un `customer.state_changed` tel que Polar le sérialise (snake_case). */
function customerStateChanged({
  externalId = USER,
  licenceGrantedAt = null,
  cloud = null,
}: Fixture): string {
  return JSON.stringify({
    type: 'customer.state_changed',
    timestamp: '2026-08-08T10:00:00Z',
    data: {
      id: 'cus_1',
      created_at: '2026-03-12T09:00:00Z',
      modified_at: null,
      metadata: {},
      external_id: externalId,
      email: 'acheteur@example.com',
      email_verified: true,
      name: null,
      billing_address: null,
      tax_id: null,
      organization_id: 'org_1',
      deleted_at: null,
      active_meters: [],
      avatar_url: 'https://example.com/avatar.png',
      granted_benefits: licenceGrantedAt
        ? [
            {
              id: 'bg_1',
              created_at: licenceGrantedAt,
              modified_at: null,
              granted_at: licenceGrantedAt,
              benefit_id: LICENCE_BENEFIT,
              benefit_type: 'custom',
              benefit_metadata: {},
              properties: {},
            },
          ]
        : [],
      active_subscriptions: cloud
        ? [
            {
              id: 'sub_1',
              created_at: '2026-03-12T09:00:00Z',
              modified_at: null,
              metadata: {},
              status: cloud.status,
              amount: 3900,
              currency: 'usd',
              recurring_interval: 'year',
              current_period_start: '2026-03-12T09:00:00Z',
              current_period_end: cloud.currentPeriodEnd,
              trial_start: null,
              trial_end: null,
              cancel_at_period_end: cloud.endsAt !== null,
              canceled_at: null,
              started_at: '2026-03-12T09:00:00Z',
              ends_at: cloud.endsAt,
              product_id: CLOUD_PRODUCT,
              discount_id: null,
              meters: [],
            },
          ]
        : [],
    },
  })
}

/* Signé comme Polar signe : le secret encodé en base64, la spec Standard
   Webhooks, et un horodatage courant — la vérification refuse au-delà de cinq
   minutes d'écart. */
function sign(body: string, id: string, secret = SECRET) {
  const timestamp = new Date()
  const webhook = new Webhook(Buffer.from(secret, 'utf-8').toString('base64'))
  return {
    'webhook-id': id,
    'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
    'webhook-signature': webhook.sign(id, timestamp, body),
    'content-type': 'application/json',
  }
}

function post(body: string, headers: Record<string, string>) {
  return app.request('/billing/webhook', { method: 'POST', body, headers })
}

beforeEach(() => {
  db.state.row = null
  db.state.writes = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /billing/webhook', () => {
  it('writes the mirror on a licence grant', async () => {
    const body = customerStateChanged({ licenceGrantedAt: '2026-03-12T09:00:00Z' })
    const response = await post(body, sign(body, 'msg_1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ outcome: 'written' })
    expect(db.state.writes).toBe(1)
    expect(db.state.row).toMatchObject({
      user_id: USER,
      polar_customer_id: 'cus_1',
      licence_granted_at: '2026-03-12T09:00:00.000Z',
      cloud_status: null,
    })
  })

  /* Critère 6 : rejouer le même webhook ne produit qu'une transition d'état.
     Pas de table de déduplication — la seconde livraison projette la même ligne,
     donc il n'y a rien à écrire. */
  it('replays without a second write', async () => {
    const body = customerStateChanged({ licenceGrantedAt: '2026-03-12T09:00:00Z' })

    await post(body, sign(body, 'msg_1'))
    const replay = await post(body, sign(body, 'msg_1'))

    await expect(replay.json()).resolves.toEqual({ outcome: 'unchanged' })
    expect(db.state.writes).toBe(1)
  })

  it('writes again when the state actually changed', async () => {
    const licence = customerStateChanged({ licenceGrantedAt: '2026-03-12T09:00:00Z' })
    await post(licence, sign(licence, 'msg_1'))

    const withCloud = customerStateChanged({
      licenceGrantedAt: '2026-03-12T09:00:00Z',
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
    })
    const response = await post(withCloud, sign(withCloud, 'msg_2'))

    await expect(response.json()).resolves.toEqual({ outcome: 'written' })
    expect(db.state.writes).toBe(2)
    expect(db.state.row).toMatchObject({
      cloud_status: 'active',
      cloud_period_end: '2027-03-12T09:00:00.000Z',
    })
  })

  /* Critère 8 : Polar accorde le Cloud, la projection le refuse et le journalise. */
  it('refuses a cloud subscription on an account without a licence, and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = customerStateChanged({
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
    })

    await post(body, sign(body, 'msg_1'))

    expect(db.state.row).toMatchObject({ licence_granted_at: null, cloud_status: null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cus_1'))
  })

  it('rejects a body signed with another secret', async () => {
    const body = customerStateChanged({ licenceGrantedAt: '2026-03-12T09:00:00Z' })
    const response = await post(body, sign(body, 'msg_1', 'whsec_wrong'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_SIGNATURE' })
    expect(db.state.writes).toBe(0)
  })

  it('rejects a body altered after signature', async () => {
    const body = customerStateChanged({ licenceGrantedAt: '2026-03-12T09:00:00Z' })
    const headers = sign(body, 'msg_1')
    const tampered = customerStateChanged({ licenceGrantedAt: '2020-01-01T00:00:00Z' })

    const response = await post(tampered, headers)

    expect(response.status).toBe(403)
    expect(db.state.writes).toBe(0)
  })

  it('ignores a customer that is attached to no account', async () => {
    const body = customerStateChanged({
      externalId: null,
      licenceGrantedAt: '2026-03-12T09:00:00Z',
    })
    const response = await post(body, sign(body, 'msg_1'))

    await expect(response.json()).resolves.toEqual({ outcome: 'ignored' })
    expect(db.state.writes).toBe(0)
  })
})
