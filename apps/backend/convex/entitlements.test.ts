import { describe, expect, it } from 'vitest'
import {
  NO_ENTITLEMENTS,
  projectCustomerState,
  toEntitlements,
  type CustomerStateInput,
  type ProjectionConfig,
} from './entitlements'

const CONFIG: ProjectionConfig = { cloudProductId: 'prod_cloud' }
const USER = '11111111-1111-4111-8111-111111111111'

function state(overrides: Partial<CustomerStateInput> = {}): CustomerStateInput {
  return { id: 'cus_1', externalId: USER, activeSubscriptions: [], ...overrides }
}

function cloudSubscription(
  overrides: Partial<CustomerStateInput['activeSubscriptions'][number]> = {},
) {
  return {
    productId: CONFIG.cloudProductId,
    status: 'active',
    currentPeriodEnd: new Date('2027-03-12T09:00:00.000Z'),
    endsAt: null,
    ...overrides,
  }
}

describe('projectCustomerState', () => {
  it('projects only Cloud state', () => {
    expect(projectCustomerState(USER, state(), CONFIG).row).toEqual({
      user_id: USER,
      polar_customer_id: 'cus_1',
      cloud_status: null,
      cloud_period_end: null,
    })

    expect(
      projectCustomerState(USER, state({ activeSubscriptions: [cloudSubscription()] }), CONFIG).row,
    ).toMatchObject({
      cloud_status: 'active',
      cloud_period_end: '2027-03-12T09:00:00.000Z',
    })
  })

  it('prefers endsAt and ignores every other product', () => {
    expect(
      projectCustomerState(
        USER,
        state({
          activeSubscriptions: [
            cloudSubscription({ endsAt: new Date('2026-11-01T00:00:00.000Z') }),
          ],
        }),
        CONFIG,
      ).row.cloud_period_end,
    ).toBe('2026-11-01T00:00:00.000Z')

    expect(
      projectCustomerState(
        USER,
        state({ activeSubscriptions: [cloudSubscription({ productId: 'prod_other' })] }),
        CONFIG,
      ).row.cloud_status,
    ).toBeNull()
  })
})

describe('toEntitlements', () => {
  const NOW = new Date('2026-08-08T00:00:00.000Z')
  const base = {
    user_id: USER,
    polar_customer_id: 'cus_1',
    cloud_status: 'active',
    cloud_period_end: '2026-11-01T00:00:00.000Z',
  }

  it('returns no Cloud right without a mirror', () => {
    expect(toEntitlements(null, USER, NOW)).toEqual(NO_ENTITLEMENTS(USER))
  })

  it('expires Cloud on the paid period and supports the owner grant', () => {
    expect(toEntitlements(base, USER, NOW).cloud).toBe(true)
    expect(toEntitlements(base, USER, new Date('2026-11-02T00:00:00.000Z')).cloud).toBe(false)
    expect(
      toEntitlements(
        { ...base, cloud_status: null, cloud_period_end: null, complimentary_cloud: true },
        USER,
        NOW,
      ).cloud,
    ).toBe(true)
  })
})
