import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ce que les dialogues reçoivent quand rien ne se passe bien.
 *
 * Un bouton d'achat qui attend une promesse jamais résolue reste en attente pour
 * toujours ; chaque geste rend donc un résultat, y compris hors réseau. Depuis
 * la migration, les refus du serveur arrivent en codes dans un `ConvexError` et
 * non en statuts HTTP — c'est cette traduction-là qui est vérifiée ici, parce
 * qu'un code non reconnu ferait afficher « réessayez » à quelqu'un à qui il
 * manque la Licence.
 */
const cloud = vi.hoisted(() => ({ action: vi.fn() }))
const requests = vi.hoisted(() => ({
  deleteAccount: vi.fn<() => Promise<{ ok: boolean; json: () => Promise<unknown> }>>(),
}))

vi.mock('@/lib/cloud', () => ({
  connect: () =>
    Promise.resolve({
      client: { action: cloud.action },
      api: { polar: { createCheckout: 'createCheckout', createPortalSession: 'createPortal' } },
      site: 'http://127.0.0.1:3211',
    }),
}))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => null }))
vi.mock('hono/client', () => ({ hc: () => ({ account: { $delete: requests.deleteAccount } }) }))

vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8787')
const { createCheckout, createPortalSession, deleteAccount } = await import('@/lib/api')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('les gestes de vente hors réseau', () => {
  it('rendent des résultats gérés pour que les dialogues quittent leur attente', async () => {
    cloud.action.mockRejectedValue(new TypeError('network down'))
    requests.deleteAccount.mockRejectedValueOnce(new TypeError('network down'))

    await expect(createCheckout('licence')).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(createPortalSession()).resolves.toBeNull()
    await expect(deleteAccount()).resolves.toBe('unknown')
  })

  it('traduisent chaque refus nommé, et rien d’autre', async () => {
    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'LICENCE_REQUIRED' }))
    await expect(createCheckout('cloud')).resolves.toEqual({
      ok: false,
      reason: 'licence-required',
    })

    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'UNAUTHENTICATED' }))
    await expect(createCheckout('licence')).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })

    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'RATE_LIMITED', retryAfter: 1200 }))
    await expect(createCheckout('licence')).resolves.toEqual({ ok: false, reason: 'rate-limited' })

    /* Le contre-test : un code que l'éditeur ne connaît pas ne doit pas hériter
       du message du refus précédent. */
    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'SOMETHING_NEW' }))
    await expect(createCheckout('licence')).resolves.toEqual({ ok: false, reason: 'failed' })
  })

  it('rendent l’URL quand le serveur l’ouvre', async () => {
    cloud.action.mockResolvedValueOnce({ url: 'https://sandbox.polar.sh/checkout/abc' })
    await expect(createCheckout('licence')).resolves.toEqual({
      ok: true,
      url: 'https://sandbox.polar.sh/checkout/abc',
    })

    cloud.action.mockResolvedValueOnce({ url: 'https://sandbox.polar.sh/portal/abc' })
    await expect(createPortalSession()).resolves.toBe('https://sandbox.polar.sh/portal/abc')
  })
})

describe('la suppression de compte', () => {
  it('distingue un compte supprimé dont le nettoyage Storage reste en attente', async () => {
    requests.deleteAccount.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true, cleanupPending: true }),
    })

    await expect(deleteAccount()).resolves.toBe('cleanup-pending')
  })

  it('distingue une suppression durable en attente d’un rejet réseau pur', async () => {
    requests.deleteAccount.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deleted: false,
        cleanupPending: true,
        outcome: 'deletion-pending',
      }),
    })

    await expect(deleteAccount()).resolves.toBe('deletion-pending')
  })
})
