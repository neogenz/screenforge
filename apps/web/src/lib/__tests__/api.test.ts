import { describe, expect, it, vi } from 'vitest'

const requests = vi.hoisted(() => ({
  deleteAccount: vi.fn<() => Promise<{ ok: boolean; json: () => Promise<unknown> }>>(),
}))

vi.mock('@/lib/supabase', () => ({ getSupabase: () => null }))
vi.mock('hono/client', () => ({
  hc: () => ({
    billing: {
      checkout: { $post: () => Promise.reject(new TypeError('network down')) },
      portal: { $post: () => Promise.reject(new TypeError('network down')) },
    },
    account: { $delete: requests.deleteAccount },
  }),
}))

vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8787')
const { createCheckout, createPortalSession, deleteAccount } = await import('@/lib/api')

describe('API billing hors réseau', () => {
  it('rend des résultats gérés pour que les dialogues quittent leur attente', async () => {
    requests.deleteAccount.mockRejectedValueOnce(new TypeError('network down'))
    await expect(createCheckout('licence')).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(createPortalSession()).resolves.toBeNull()
    await expect(deleteAccount()).resolves.toBe('unknown')
  })

  it('distingue un compte supprimé dont le nettoyage Storage reste en attente', async () => {
    requests.deleteAccount.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true, cleanupPending: true }),
    })

    await expect(deleteAccount()).resolves.toBe('cleanup-pending')
  })
})
