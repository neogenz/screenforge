import { describe, expect, it } from 'vitest'
import {
  NO_ENTITLEMENTS,
  projectCustomerState,
  toEntitlements,
  type CustomerStateInput,
  type ProjectionConfig,
} from './entitlements'

const CONFIG: ProjectionConfig = {
  licenceBenefitId: 'ben_licence',
  cloudProductId: 'prod_cloud',
}

const USER = '11111111-1111-4111-8111-111111111111'

function state(overrides: Partial<CustomerStateInput> = {}): CustomerStateInput {
  return {
    id: 'cus_1',
    externalId: USER,
    grantedBenefits: [],
    activeSubscriptions: [],
    ...overrides,
  }
}

function licenceGrant(grantedAt: string) {
  return { benefitId: CONFIG.licenceBenefitId, grantedAt: new Date(grantedAt) }
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
  it('nothing bought yields an empty row', () => {
    const { row, cloudRefusedWithoutLicence } = projectCustomerState(USER, state(), CONFIG)
    expect(row).toEqual({
      user_id: USER,
      polar_customer_id: 'cus_1',
      licence_granted_at: null,
      cloud_status: null,
      cloud_period_end: null,
    })
    expect(cloudRefusedWithoutLicence).toBe(false)
  })

  it('grants the licence from its benefit', () => {
    const { row } = projectCustomerState(
      USER,
      state({ grantedBenefits: [licenceGrant('2026-03-12T09:00:00.000Z')] }),
      CONFIG,
    )
    expect(row.licence_granted_at).toBe('2026-03-12T09:00:00.000Z')
  })

  it('keeps the earliest grant when a benefit is re-granted', () => {
    const { row } = projectCustomerState(
      USER,
      state({
        grantedBenefits: [
          licenceGrant('2026-09-01T00:00:00.000Z'),
          licenceGrant('2026-03-12T09:00:00.000Z'),
        ],
      }),
      CONFIG,
    )
    expect(row.licence_granted_at).toBe('2026-03-12T09:00:00.000Z')
  })

  it('ignores a benefit that is not the licence', () => {
    const { row } = projectCustomerState(
      USER,
      state({ grantedBenefits: [{ benefitId: 'ben_autre', grantedAt: new Date() }] }),
      CONFIG,
    )
    expect(row.licence_granted_at).toBeNull()
  })

  it('grants the cloud on top of a licence, dated on the current period', () => {
    const { row, cloudRefusedWithoutLicence } = projectCustomerState(
      USER,
      state({
        grantedBenefits: [licenceGrant('2026-03-12T09:00:00.000Z')],
        activeSubscriptions: [cloudSubscription()],
      }),
      CONFIG,
    )
    expect(row.cloud_status).toBe('active')
    expect(row.cloud_period_end).toBe('2027-03-12T09:00:00.000Z')
    expect(cloudRefusedWithoutLicence).toBe(false)
  })

  it('prefers endsAt over the current period once cancelled', () => {
    const { row } = projectCustomerState(
      USER,
      state({
        grantedBenefits: [licenceGrant('2026-03-12T09:00:00.000Z')],
        activeSubscriptions: [cloudSubscription({ endsAt: new Date('2026-11-01T00:00:00.000Z') })],
      }),
      CONFIG,
    )
    expect(row.cloud_period_end).toBe('2026-11-01T00:00:00.000Z')
  })

  it('ignores a subscription to another product', () => {
    const { row, cloudRefusedWithoutLicence } = projectCustomerState(
      USER,
      state({
        grantedBenefits: [licenceGrant('2026-03-12T09:00:00.000Z')],
        activeSubscriptions: [cloudSubscription({ productId: 'prod_autre' })],
      }),
      CONFIG,
    )
    expect(row.cloud_status).toBeNull()
    expect(cloudRefusedWithoutLicence).toBe(false)
  })

  /* Le cas que le checkout ne peut pas empêcher : un abonnement Cloud créé
     directement depuis Polar, sur un compte qui n'a pas la Licence. */
  it('refuses the cloud when the licence is absent, and says so', () => {
    const { row, cloudRefusedWithoutLicence } = projectCustomerState(
      USER,
      state({ activeSubscriptions: [cloudSubscription()] }),
      CONFIG,
    )
    expect(row.cloud_status).toBeNull()
    expect(row.cloud_period_end).toBeNull()
    expect(cloudRefusedWithoutLicence).toBe(true)
  })
})

describe('toEntitlements', () => {
  const NOW = new Date('2026-08-08T00:00:00.000Z')

  it('an unknown user holds nothing', () => {
    expect(toEntitlements(null, USER, NOW)).toEqual(NO_ENTITLEMENTS(USER))
  })

  it('reads the licence as perpetual', () => {
    const entitlements = toEntitlements(
      {
        user_id: USER,
        polar_customer_id: 'cus_1',
        licence_granted_at: '2026-03-12T09:00:00+00:00',
        cloud_status: null,
        cloud_period_end: null,
      },
      USER,
      NOW,
    )
    expect(entitlements.licence).toBe(true)
    expect(entitlements.cloud).toBe(false)
  })

  it('keeps the cloud until the end of the paid period', () => {
    const row = {
      user_id: USER,
      polar_customer_id: 'cus_1',
      licence_granted_at: '2026-03-12T09:00:00+00:00',
      cloud_status: 'active',
      cloud_period_end: '2026-11-01T00:00:00+00:00',
    }
    expect(toEntitlements(row, USER, NOW).cloud).toBe(true)

    /* Après la fin de période, le Cloud s'éteint — et la Licence survit. */
    const later = toEntitlements(row, USER, new Date('2026-11-02T00:00:00.000Z'))
    expect(later.cloud).toBe(false)
    expect(later.licence).toBe(true)
  })

  it('never grants the cloud without the licence, whatever the mirror says', () => {
    const entitlements = toEntitlements(
      {
        user_id: USER,
        polar_customer_id: 'cus_1',
        licence_granted_at: null,
        cloud_status: 'active',
        cloud_period_end: '2027-01-01T00:00:00+00:00',
      },
      USER,
      NOW,
    )
    expect(entitlements.cloud).toBe(false)
  })
})
