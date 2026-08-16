import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheEntitlements, readCachedEntitlements, type Entitlements } from '@/lib/entitlements'
import { useAuthStore } from '@/stores/auth.store'

function entitlement(userId: string, cloud: boolean): Entitlements {
  return {
    userId,
    cloud,
    cloudStatus: cloud ? 'active' : null,
    cloudPeriodEnd: cloud ? '2099-01-01T00:00:00Z' : null,
  }
}

describe('cache Cloud par compte', () => {
  const entries = new Map<string, string>()

  beforeEach(() => {
    entries.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
    })
    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      entitlements: null,
      entitlementsVerified: false,
    })
  })

  it('isole le dernier état connu par compte et expire la période localement', () => {
    cacheEntitlements(entitlement('u1', true))
    expect(readCachedEntitlements('u1')?.cloud).toBe(true)
    expect(readCachedEntitlements('u2')).toBeNull()

    cacheEntitlements({
      userId: 'u2',
      cloud: true,
      cloudStatus: 'active',
      cloudPeriodEnd: '2020-01-01T00:00:00Z',
    })
    expect(readCachedEntitlements('u2')?.cloud).toBe(false)
  })

  it('ignore une réponse d’un autre compte et ne valide jamais le cache seul', () => {
    const first = entitlement('u1', true)
    const second = entitlement('u2', false)
    cacheEntitlements(second)
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u1', email: null },
      entitlements: first,
      entitlementsVerified: false,
    })

    useAuthStore.getState().setUser({ id: 'u2', email: null })
    expect(useAuthStore.getState().entitlements).toEqual(second)
    expect(useAuthStore.getState().entitlementsVerified).toBe(false)

    useAuthStore.getState().setEntitlements(first)
    expect(useAuthStore.getState().entitlements).toEqual(second)
    useAuthStore.getState().setEntitlements(second)
    expect(useAuthStore.getState().entitlementsVerified).toBe(true)
  })
})
