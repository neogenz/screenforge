import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLANS, planName } from '@/lib/plans'

/**
 * Ce que les dialogues reçoivent quand rien ne se passe bien.
 *
 * Un bouton d'achat qui attend une promesse jamais résolue reste en attente pour
 * toujours ; chaque geste rend donc un résultat, y compris hors réseau. Les
 * refus du serveur arrivent en codes dans un `ConvexError` et non en statuts
 * HTTP — c'est cette traduction-là qui est vérifiée ici, parce qu'un code non
 * reconnu affiche l'échec générique plutôt qu'une règle commerciale inventée.
 */
const cloud = vi.hoisted(() => ({ action: vi.fn(), mutation: vi.fn() }))

vi.mock('@/lib/cloud', () => ({
  connect: () =>
    Promise.resolve({
      client: { action: cloud.action, mutation: cloud.mutation },
      api: {
        polar: { createCheckout: 'createCheckout', createPortalSession: 'createPortal' },
        accountDeletion: { requestAccountDeletion: 'requestAccountDeletion' },
      },
      site: 'http://127.0.0.1:3211',
    }),
}))

vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3210')
const { createCheckout, createPortalSession, deleteAccount } = await import('@/lib/account')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('les gestes de vente hors réseau', () => {
  it('n’expose que les deux offres Local et Cloud', () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(['local', 'cloud'])
    expect(planName(null)).toBe('Local')
    expect(
      planName({
        userId: 'u1',
        cloud: false,
        cloudStatus: null,
        cloudPeriodEnd: null,
      }),
    ).toBe('Local')
    expect(
      planName({
        userId: 'u2',
        cloud: true,
        cloudStatus: 'active',
        cloudPeriodEnd: '2027-03-12T09:00:00Z',
      }),
    ).toBe('Cloud')
  })

  it('rendent des résultats gérés pour que les dialogues quittent leur attente', async () => {
    cloud.action.mockRejectedValue(new TypeError('network down'))
    cloud.mutation.mockRejectedValue(new TypeError('network down'))

    await expect(createCheckout('cloud')).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(createPortalSession()).resolves.toBeNull()
    await expect(deleteAccount()).resolves.toBe('unknown')
  })

  it('traduisent chaque refus nommé, et rien d’autre', async () => {
    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'UNAUTHENTICATED' }))
    await expect(createCheckout('cloud')).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })

    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'RATE_LIMITED', retryAfter: 1200 }))
    await expect(createCheckout('cloud')).resolves.toEqual({ ok: false, reason: 'rate-limited' })

    /* Le contre-test : un code que l'éditeur ne connaît pas ne doit pas hériter
       du message du refus précédent. */
    cloud.action.mockRejectedValueOnce(new ConvexError({ code: 'SOMETHING_NEW' }))
    await expect(createCheckout('cloud')).resolves.toEqual({ ok: false, reason: 'failed' })
  })

  it('rendent l’URL quand le serveur l’ouvre', async () => {
    cloud.action.mockResolvedValueOnce({ url: 'https://sandbox.polar.sh/checkout/abc' })
    await expect(createCheckout('cloud')).resolves.toEqual({
      ok: true,
      url: 'https://sandbox.polar.sh/checkout/abc',
    })

    cloud.action.mockResolvedValueOnce({ url: 'https://sandbox.polar.sh/portal/abc' })
    await expect(createPortalSession()).resolves.toBe('https://sandbox.polar.sh/portal/abc')
  })
})

describe('la suppression de compte', () => {
  /**
   * Les trois issues du serveur voyagent telles quelles : la mutation les rend
   * déjà nommées, et les retraduire ici rouvrirait l'écart que l'ancienne
   * lecture de statuts HTTP avait — `{ deleted: false, cleanupPending: true }`
   * demandait trois conditions pour dire un seul mot.
   */
  it('rend l’issue du serveur sans la réinterpréter', async () => {
    for (const outcome of ['deleted', 'cleanup-pending', 'deletion-pending'] as const) {
      cloud.mutation.mockResolvedValueOnce(outcome)
      await expect(deleteAccount()).resolves.toBe(outcome)
    }
  })

  /**
   * La distinction qui compte, et la seule que l'éditeur puisse faire : un refus
   * nommé prouve que rien n'a commencé — le compte reste actif et on peut le
   * dire. Une rupture de transport ne prouve rien, et proposer « réessayez »
   * après une suppression peut-être effectuée serait mentir.
   */
  it('distingue un refus nommé d’une rupture de transport', async () => {
    cloud.mutation.mockRejectedValueOnce(new ConvexError({ code: 'RATE_LIMITED', retryAfter: 60 }))
    await expect(deleteAccount()).resolves.toBe('failed')

    cloud.mutation.mockRejectedValueOnce(new TypeError('socket closed'))
    await expect(deleteAccount()).resolves.toBe('unknown')
  })
})
