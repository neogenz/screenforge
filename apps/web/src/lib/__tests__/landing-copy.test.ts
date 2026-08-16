import { expect, test } from 'vitest'
import { copy } from '@/landing/copy'

test.each(['en', 'fr'] as const)(
  'la landing %s ne présente que Local gratuit et Cloud payant',
  (lang) => {
    const pricing = copy[lang].pricing
    expect(Object.keys(pricing.plans)).toEqual(['local', 'cloud'])
    expect(pricing.plans.local.price).toMatch(/(?:\$0|0 \$)/)
    expect(pricing.plans.local.available).toBe(true)
    expect(pricing.plans.cloud.price).toMatch(/(?:\$39|39 \$)/)
    expect(pricing.plans.cloud.available).toBe(true)

    const rendered = JSON.stringify(copy[lang])
    expect(rendered).not.toMatch(
      /(?:\$49|49 \$|free trial|essai gratuit|three watermarked|trois exports filigranés)/i,
    )
  },
)
