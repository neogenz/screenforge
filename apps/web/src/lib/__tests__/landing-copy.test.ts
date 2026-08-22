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

/* La marche à suivre de la section IA cite la commande du démon MCP ; elle
   est recopiée dans la vitrine (importer le client y tirerait les stores), et
   c'est ici qu'on la tient en phase avec `MCP_COMMAND`. */
test.each(['en', 'fr'] as const)('la section IA %s cite la vraie commande MCP', async (lang) => {
  const { MCP_COMMAND } = await import('@/lib/mcp/client')
  const agent = copy[lang].agent
  expect(agent.setupSteps.join('\n')).toContain(MCP_COMMAND)
  expect(copy[lang].faq.items.map((item) => item.a).join('\n')).toContain(MCP_COMMAND)
})

/* Le hero dit une chose. Quatre lignes de sous-titre ne se lisent pas, et la
   limite est ici plutôt que dans une revue : c'est la seule mesure qui survit
   à une réécriture de la copie. */
test.each(['en', 'fr'] as const)('le sous-titre du hero %s tient en deux phrases', (lang) => {
  expect(copy[lang].hero.sub.length).toBeLessThanOrEqual(160)
})

/* La langue de l'éditeur ne change l'expérience que du visiteur anglophone :
   la page française n'a rien à annoncer. */
test('la note de langue est anglaise seulement', () => {
  expect(copy.en.hero.langNote).toBeTruthy()
  expect(copy.fr.hero.langNote).toBeUndefined()
})
