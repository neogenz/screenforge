import { describe, expect, it, vi } from 'vitest'
import { handleAccountDeletionOutcome } from '@/lib/account-deletion-ui'

describe('retour local après suppression de compte', () => {
  it('déconnecte et ferme immédiatement une demande durable encore en cours', async () => {
    const signOut = vi.fn(async () => {})
    const close = vi.fn()
    const retry = vi.fn()
    const notify = vi.fn()

    await handleAccountDeletionOutcome('deletion-pending', { signOut, close, retry, notify })

    expect(signOut).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Suppression en cours'), 'info')
    expect(notify).not.toHaveBeenCalledWith(
      expect.stringContaining('reste actif'),
      expect.anything(),
    )
  })
})
