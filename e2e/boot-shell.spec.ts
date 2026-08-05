import { expect, test } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Ce que la page montre avant que le paquet critique n'ait fini.
 *
 * Mesuré : 272 ko gzip sur le chemin critique, dont Fabric — irréductible pour
 * un éditeur canvas. Le défaut n'était pas la taille, c'est que `#root` restait
 * vide pendant tout ce temps : un aplat de couleur, sans nom ni signe de vie.
 * Et la feuille Inter était déclarée « blocking » par le navigateur, donc rien
 * ne pouvait s'afficher avant un aller-retour vers une origine tierce.
 */

test('peint un squelette nommé avant le montage, sans feuille bloquante', async ({ request, page }) => {
  const html = await (await request.get('/')).text()

  // Le squelette est dans le HTML, pas produit par le script qu'on attend.
  expect(html).toContain('Chargement de ScreenForge')
  expect(html).toMatch(/<div id="root">\s*<div class="boot"/)

  // La feuille de polices sort du chemin critique et y revient au chargement.
  expect(html).toMatch(/rel="stylesheet"[\s\S]*?media="print"[\s\S]*?onload="this\.media='all'"/)
  expect(html).toContain('rel="preload"')

  // Une fois monté, React a vidé le conteneur : rien à retirer à la main.
  await waitForApp(page)
  await expect(page.locator('.boot')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'ScreenForge', level: 1 })).toBeAttached()

  // `renderBlockingStatus` est plus récent que la lib DOM de TypeScript : c'est
  // le navigateur qui répond, et c'est lui qui faisait autorité sur le constat.
  const blocking = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes('fonts.googleapis.com'))
      .map((entry) => (entry as { renderBlockingStatus?: string }).renderBlockingStatus),
  )
  expect(blocking.length).toBeGreaterThan(0)
  expect(blocking).not.toContain('blocking')
})
