import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ getSupabase: () => null }))
vi.mock('hono/client', () => ({
  hc: () => ({
    billing: {
      checkout: { $post: () => Promise.reject(new TypeError('network down')) },
      portal: { $post: () => Promise.reject(new TypeError('network down')) },
    },
    account: { $delete: () => Promise.reject(new TypeError('network down')) },
  }),
}))

vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8787')
const { createCheckout, createPortalSession, deleteAccount } = await import('@/lib/api')

describe('API billing hors réseau', () => {
  it('rend des résultats gérés pour que les dialogues quittent leur attente', async () => {
    await expect(createCheckout('licence')).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(createPortalSession()).resolves.toBeNull()
    await expect(deleteAccount()).resolves.toBe(false)
  })
})
