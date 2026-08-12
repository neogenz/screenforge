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

test('peint un squelette nommé avant le montage, sans feuille bloquante', async ({
  request,
  page,
}) => {
  const html = await (await request.get('/')).text()

  // Le squelette est dans le HTML, pas produit par le script qu'on attend.
  expect(html).toContain('Chargement de ScreenForge')
  expect(html).toMatch(/<div id="root">\s*<div class="boot"/)

  // La feuille de polices sort du chemin critique et y revient au chargement.
  /* Les espaces autour du `=` sont ceux que Prettier met dans l'attribut : le
     motif serré ne matchait plus depuis qu'il formate le HTML, et l'assertion
     échouait sur une page pourtant correcte. */
  expect(html).toMatch(
    /rel="stylesheet"[\s\S]*?media="print"[\s\S]*?onload="this\.media\s*=\s*'all'"/,
  )
  expect(html).toContain('rel="preload"')
  expect(html.indexOf("localStorage.getItem('screenforge-theme')")).toBeLessThan(
    html.indexOf('<style>'),
  )

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

async function expectBootTheme(
  page: import('@playwright/test').Page,
  preference: 'light' | 'dark' | null,
  storageUnavailable = false,
) {
  await page.addInitScript(
    ({ savedTheme, unavailable }) => {
      if (unavailable) {
        Storage.prototype.getItem = () => {
          throw new DOMException('Storage disabled', 'SecurityError')
        }
        return
      }
      if (savedTheme) localStorage.setItem('screenforge-theme', savedTheme)
      else localStorage.removeItem('screenforge-theme')
    },
    { savedTheme: preference, unavailable: storageUnavailable },
  )
  await page.route('**/src/main.tsx*', (route) => route.abort())
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const rendered = await page.evaluate(() => {
    const resolveColor = (value: string) => {
      const probe = document.createElement('span')
      probe.style.color = value
      document.body.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    const root = getComputedStyle(document.documentElement)
    const boot = getComputedStyle(document.querySelector('.boot')!)
    return {
      light: document.documentElement.classList.contains('light'),
      background: root.backgroundColor,
      ink: boot.color,
      expectedBackground: resolveColor(
        document.documentElement.classList.contains('light')
          ? 'oklch(0.965 0 0)'
          : 'oklch(0.145 0 0)',
      ),
      expectedInk: resolveColor(
        document.documentElement.classList.contains('light') ? 'oklch(0.4 0 0)' : 'oklch(0.78 0 0)',
      ),
    }
  })

  expect(rendered.light).toBe(preference === 'light' && !storageUnavailable)
  expect(rendered.background).toBe(rendered.expectedBackground)
  expect(rendered.ink).toBe(rendered.expectedInk)
  await expect(page.locator('.boot')).toBeVisible()
}

test('peint le boot clair avant le montage quand cette préférence est enregistrée', async ({
  page,
}) => {
  await expectBootTheme(page, 'light')
})

test('garde le boot sombre avant le montage sans préférence ou avec la préférence sombre', async ({
  browser,
}) => {
  for (const preference of [null, 'dark'] as const) {
    const page = await browser.newPage()
    await expectBootTheme(page, preference)
    await page.close()
  }
})

test('garde le boot sombre si le stockage est indisponible', async ({ page }) => {
  await expectBootTheme(page, null, true)
})
