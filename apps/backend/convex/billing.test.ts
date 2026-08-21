import { Webhook } from 'standardwebhooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from './_generated/dataModel'
import { MAX_WEBHOOK_BYTES } from './billing'
import { testConvex } from './test.helpers'

/**
 * Le webhook de bout en bout : signature réelle, analyse réelle du SDK Polar,
 * projection réelle, écriture réelle.
 *
 * Rien n'est simulé du chemin : les octets sont signés avec le vrai secret,
 * analysés par le vrai SDK Polar, et la mutation écrit dans le simulateur. Une
 * suite qui partirait d'un objet déjà analysé prouverait la projection et rien
 * de la réception — or c'est la réception qui décide si une signature forgée
 * entre.
 */

const SECRET = 'whsec_screenforge_test'
const CLOUD_PRODUCT = 'prod_cloud'

process.env.POLAR_ACCESS_TOKEN = 'polar_at_test'
process.env.ABUSE_KEY_SECRET = 'test-abuse-key'
process.env.POLAR_WEBHOOK_SECRET = SECRET
process.env.POLAR_CLOUD_PRODUCT_ID = CLOUD_PRODUCT
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

interface Fixture {
  externalId?: string | null
  cloud?: { status: string; currentPeriodEnd: string; endsAt: string | null } | null
  timestamp?: string
}

/** Un `customer.state_changed` tel que Polar le sérialise (snake_case). */
function customerStateChanged({
  externalId = null,
  cloud = null,
  timestamp = '2026-08-08T10:00:00Z',
}: Fixture): string {
  return JSON.stringify({
    type: 'customer.state_changed',
    timestamp,
    data: {
      id: 'cus_1',
      created_at: '2026-03-12T09:00:00Z',
      modified_at: null,
      metadata: {},
      external_id: externalId,
      email: 'acheteur@example.com',
      email_verified: true,
      type: 'individual',
      name: null,
      billing_name: null,
      billing_address: null,
      tax_id: null,
      organization_id: 'org_1',
      deleted_at: null,
      active_meters: [],
      avatar_url: 'https://example.com/avatar.png',
      granted_benefits: [],
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

type Stack = ReturnType<typeof testConvex>

function post(t: Stack, body: BodyInit, headers: Record<string, string>) {
  return t.fetch('/billing/webhook', { method: 'POST', body, headers })
}

async function account(t: Stack): Promise<Id<'users'>> {
  return await t.run((ctx) => ctx.db.insert('users', {}))
}

async function mirror(t: Stack) {
  return await t.run((ctx) => ctx.db.query('entitlements').collect())
}

let t: Stack

beforeEach(() => {
  process.env.ABUSE_KEY_SECRET = 'test-abuse-key'
  t = testConvex()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /billing/webhook', () => {
  it('écrit un miroir Cloud vide pour un compte connu', async () => {
    const userId = await account(t)
    const body = customerStateChanged({
      externalId: userId,
    })

    const response = await post(t, body, sign(body, 'msg_1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ outcome: 'written' })
    expect(await mirror(t)).toMatchObject([
      {
        userId,
        polarCustomerId: 'cus_1',
        cloudStatus: null,
      },
    ])
  })

  /* Critère 6 de la phase d'origine : rejouer le même webhook ne produit qu'une
     transition d'état. Pas de table de déduplication — la seconde livraison
     projette la même ligne, donc il n'y a rien à écrire. */
  it('rejoue sans seconde écriture', async () => {
    const userId = await account(t)
    const body = customerStateChanged({
      externalId: userId,
    })

    await post(t, body, sign(body, 'msg_1'))
    const replay = await post(t, body, sign(body, 'msg_1'))

    await expect(replay.json()).resolves.toEqual({ outcome: 'unchanged' })
    expect(await mirror(t)).toHaveLength(1)
  })

  it('réécrit quand l’état a réellement changé', async () => {
    const userId = await account(t)
    const empty = customerStateChanged({ externalId: userId })
    await post(t, empty, sign(empty, 'msg_1'))

    const withCloud = customerStateChanged({
      externalId: userId,
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
      timestamp: '2026-08-08T11:00:00Z',
    })
    const response = await post(t, withCloud, sign(withCloud, 'msg_2'))

    await expect(response.json()).resolves.toEqual({ outcome: 'written' })
    expect(await mirror(t)).toMatchObject([
      { cloudStatus: 'active', cloudPeriodEnd: '2027-03-12T09:00:00.000Z' },
    ])
  })

  /* Critère 3 : deux livraisons désordonnées laissent la ligne sur la plus
     récente, quel que soit l'ordre d'arrivée. */
  it('ignore un état plus ancien livré après une révocation', async () => {
    const userId = await account(t)
    const revoked = customerStateChanged({ externalId: userId, timestamp: '2026-08-08T12:00:00Z' })
    await post(t, revoked, sign(revoked, 'msg_new'))

    const staleGrant = customerStateChanged({
      externalId: userId,
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
      timestamp: '2026-08-08T11:00:00Z',
    })
    const response = await post(t, staleGrant, sign(staleGrant, 'msg_old'))

    await expect(response.json()).resolves.toEqual({ outcome: 'ignored' })
    expect(await mirror(t)).toMatchObject([{ cloudStatus: null }])
  })

  it('reflète un abonnement Cloud actif', async () => {
    const userId = await account(t)
    const body = customerStateChanged({
      externalId: userId,
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
    })

    const response = await post(t, body, sign(body, 'msg_1'))

    expect(response.status).toBe(200)
    expect(await mirror(t)).toMatchObject([
      {
        cloudStatus: 'active',
        cloudPeriodEnd: '2027-03-12T09:00:00.000Z',
      },
    ])
  })

  /* Critère 2, premier volet. */
  it('rejette un corps signé avec un autre secret', async () => {
    const userId = await account(t)
    const body = customerStateChanged({
      externalId: userId,
    })

    const response = await post(t, body, sign(body, 'msg_1', 'whsec_wrong'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_SIGNATURE' })
    expect(await mirror(t)).toHaveLength(0)
  })

  it('rejette un corps modifié après signature', async () => {
    const userId = await account(t)
    const body = customerStateChanged({
      externalId: userId,
    })
    const headers = sign(body, 'msg_1')
    const tampered = customerStateChanged({
      externalId: userId,
      cloud: { status: 'active', currentPeriodEnd: '2027-03-12T09:00:00Z', endsAt: null },
    })

    const response = await post(t, tampered, headers)

    expect(response.status).toBe(403)
    expect(await mirror(t)).toHaveLength(0)
  })

  /* Critère 2, troisième volet : 503 et non 200. */
  it('demande de rejouer un customer.state_changed signé mais incomplet', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = JSON.stringify({
      type: 'customer.state_changed',
      timestamp: '2026-08-08T10:00:00Z',
      data: { email: 'donnee-client-sensible@example.com' },
    })

    const response = await post(t, body, sign(body, 'msg_invalid_state'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_CUSTOMER_STATE' })
    expect(await mirror(t)).toHaveLength(0)
    expect(report).toHaveBeenCalledWith(
      'Invalid Polar customer state; delivery must be retried.',
      expect.stringMatching(/:/),
    )
    expect(JSON.stringify(report.mock.calls)).not.toContain('donnee-client-sensible@example.com')
  })

  /* Critère 2, deuxième volet. */
  it('acquitte un type signé explicitement non pris en charge', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = JSON.stringify({
      type: 'screenforge.future_event',
      timestamp: '2026-08-08T10:00:00Z',
      data: {},
    })

    const response = await post(t, body, sign(body, 'msg_irrelevant'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ignored: true })
    expect(await mirror(t)).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(
      'Ignored unsupported Polar webhook type: screenforge.future_event.',
    )
  })

  it('ignore un client rattaché à aucun compte', async () => {
    const body = customerStateChanged({
      externalId: null,
    })

    const response = await post(t, body, sign(body, 'msg_1'))

    await expect(response.json()).resolves.toEqual({ outcome: 'ignored' })
    expect(await mirror(t)).toHaveLength(0)
  })

  it('accepte exactement la limite puis refuse un Content-Length supérieur', async () => {
    const userId = await account(t)
    const base = customerStateChanged({ externalId: userId })
    const exact = base + ' '.repeat(MAX_WEBHOOK_BYTES - new TextEncoder().encode(base).byteLength)
    const accepted = await post(t, exact, {
      ...sign(exact, 'msg_exact'),
      'content-length': String(MAX_WEBHOOK_BYTES),
    })
    expect(accepted.status).toBe(200)

    const rejected = await post(t, '{}', {
      ...sign('{}', 'msg_declared_large'),
      'content-length': String(MAX_WEBHOOK_BYTES + 1),
    })
    expect(rejected.status).toBe(413)
    await expect(rejected.json()).resolves.toEqual({ error: 'PAYLOAD_TOO_LARGE' })
  })

  it('borne aussi un corps sans taille déclarée et refuse un UTF-8 invalide', async () => {
    const oversized = await post(
      t,
      new Uint8Array(MAX_WEBHOOK_BYTES + 1),
      sign('{}', 'msg_stream_large'),
    )
    expect(oversized.status).toBe(413)

    const invalid = await post(t, new Uint8Array([0xff]), sign('{}', 'msg_invalid_utf8'))
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: 'INVALID_BODY' })
    expect(await mirror(t)).toHaveLength(0)
  })

  it('refuse les en-têtes absents ou surdimensionnés avant le SDK', async () => {
    const missing = await post(t, '{}', {})
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'INVALID_HEADERS' })

    const oversized = await post(t, '{}', {
      'webhook-id': 'msg',
      'webhook-timestamp': '0',
      'webhook-signature': 'x'.repeat(2049),
    })
    expect(oversized.status).toBe(400)
    expect(await mirror(t)).toHaveLength(0)
  })

  it('borne une source avant les en-têtes et laisse une autre source intacte', async () => {
    let source = '203.0.113.30'
    const limited = testConvex(() => source)
    for (let index = 0; index < 30; index += 1) {
      expect((await post(limited, '{}', {})).status).toBe(400)
    }

    const refused = await post(limited, '{}', {
      ...sign('{}', 'msg_limited'),
      'content-length': String(MAX_WEBHOOK_BYTES + 1),
    })
    expect(refused.status).toBe(429)
    expect(refused.headers.get('retry-after')).toMatch(/^\d+$/)

    source = '203.0.113.31'
    const userId = await account(limited)
    const body = customerStateChanged({ externalId: userId })
    expect((await post(limited, body, sign(body, 'msg_other_source'))).status).toBe(200)
  })

  it('échoue fermé sans IP ou secret sans divulguer la cause privée', async () => {
    const withoutIp = await post(testConvex(null), '{}', sign('{}', 'msg_no_ip'))
    expect(withoutIp.status).toBe(503)
    expect(JSON.stringify(await withoutIp.json())).not.toMatch(/203\.0\.113|test-abuse-key/)

    process.env.ABUSE_KEY_SECRET = ''
    const withoutSecret = await post(testConvex(), '{}', sign('{}', 'msg_no_secret'))
    expect(withoutSecret.status).toBe(503)
    expect(JSON.stringify(await withoutSecret.json())).not.toContain('test-abuse-key')
  })

  it.each(['', '{'])('demande de rejouer un JSON signé vide ou invalide', async (body) => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await post(t, body, sign(body, `msg_bad_json_${body.length}`))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_CUSTOMER_STATE' })
    expect(report).toHaveBeenCalled()
  })

  /* `externalId` est une chaîne venue du dehors, et rien dans le schéma ne
     garantit qu'elle désigne un compte : c'est la mutation qui le vérifie. */
  it('ignore un identifiant externe qui ne désigne aucun compte', async () => {
    const known = await account(t)
    const body = customerStateChanged({
      externalId: `${known}zz`,
    })

    const response = await post(t, body, sign(body, 'msg_1'))

    await expect(response.json()).resolves.toEqual({ outcome: 'ignored' })
    expect(await mirror(t)).toHaveLength(0)
  })
})
