import { expect, test } from 'vitest'
import { copy } from '@/landing/copy'
import { CLOUD_OFFER, cloudOfferSummary } from '@screenforge/project-format'

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

test.each(['en', 'fr'] as const)('la landing %s publie le contrat Cloud appliqué', (lang) => {
  const rendered = JSON.stringify(copy[lang])
  expect(rendered).toContain(String(CLOUD_OFFER.price.amount))
  expect(rendered).toContain(cloudOfferSummary(lang))
  expect(rendered).not.toMatch(/sans limite artificielle|tax(?:es)? (?:included|comprises)/i)
})

test.each(['en', 'fr'] as const)(
  'la landing %s annonce tous les profils sans redistribuer les bezels Apple',
  (lang) => {
    const landing = copy[lang]
    const headline = `${landing.meta.description} ${landing.hero.sub} ${landing.features.export.body}`
    const faq = landing.faq.items.map(({ q, a }) => `${q} ${a}`).join('\n')

    expect(headline).toMatch(/iPhone 6[,.]9″/)
    expect(headline).toContain('iPad 13″')
    expect(headline).toContain('2064×2752')
    expect(headline).toMatch(/six (?:official Apple Watch formats|formats Apple Watch officiels)/)
    expect(faq).toMatch(/1320×2868/)
    expect(faq).toMatch(/422×514.*410×502.*416×496.*396×484.*368×448.*312×390/s)
    expect(faq).toMatch(/(?:not bundled or redistributed|ni inclus ni redistribués)/)
    expect(faq).toMatch(/iPad 13″.*(?:in portrait|uniquement en portrait)/s)
  },
)

/* La marche à suivre de la section IA cite la commande du démon MCP ; elle
   est recopiée dans la vitrine (importer le client y tirerait les stores), et
   c'est ici qu'on la tient en phase avec `MCP_COMMAND`. */
test.each(['en', 'fr'] as const)('la section IA %s cite la vraie commande MCP', async (lang) => {
  const { MCP_COMMAND } = await import('@/lib/mcp/client')
  const agent = copy[lang].agent
  expect(agent.setupSteps.join('\n')).toContain(MCP_COMMAND)
  expect(copy[lang].faq.items.map((item) => item.a).join('\n')).toContain(MCP_COMMAND)
})
