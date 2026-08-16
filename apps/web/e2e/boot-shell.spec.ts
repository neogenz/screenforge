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
  expect(html).toMatch(/rel="stylesheet"[\s\S]*?media="print"[\s\S]*?data-screenforge-font/)
  expect(html).toContain('rel="preload"')
  expect(html).not.toMatch(/\son[a-z]+\s*=/i)

  // Le thème et le retour de la fonte vivent dans le même script same-origin,
  // avant les styles du boot : aucune permission `unsafe-inline` n'est requise.
  const boot = await (await request.get('/boot.js')).text()
  expect(boot).toContain("localStorage.getItem('screenforge-theme')")
  expect(boot).toContain("querySelectorAll('link[data-screenforge-font]')")
  expect(html.indexOf('<script src="/boot.js"></script>')).toBeLessThan(html.indexOf('<style>'))

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

test('déclare la même icône servie en local sur la landing et l’éditeur', async ({ request }) => {
  const [app, landing, icon] = await Promise.all([
    request.get('/'),
    request.get('/landing.html'),
    request.get('/favicon.svg'),
  ])

  for (const html of [await app.text(), await landing.text()]) {
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />')
  }
  expect(icon.ok()).toBe(true)
  expect(icon.headers()['content-type']).toContain('image/svg+xml')
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
      /* Les deux valeurs recopient `--color-background`, pas `--color-stage` :
         le boot peint ce que le chrome peindra en premier au montage, sinon un
         boot plus sombre que l'application se lit comme un double flash. */
      expectedBackground: resolveColor(
        document.documentElement.classList.contains('light')
          ? 'oklch(0.965 0 0)'
          : 'oklch(0.175 0 0)',
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

/**
 * L'invariant local-first, mesuré et pas seulement écrit.
 *
 * `cloudConfigured` est une constante de compilation : sans `VITE_CONVEX_URL`,
 * tout ce qu'elle garde doit disparaître à l'élagage. Un `import` statique
 * ajouté par mégarde dans `lib/convex.ts` ne casserait rien de visible — il
 * ferait juste télécharger le SDK à quelqu'un qui n'aura jamais de compte, et
 * personne ne s'en apercevrait avant la prochaine mesure de poids.
 */
test('sans instance cloud, rien du SDK n’est demandé au réseau', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))

  await waitForApp(page)
  /* Une image du chargement paresseux : sans cette attente, l'absence
     constatée serait celle d'un module qui n'a pas encore eu le temps d'être
     demandé. */
  await page.waitForTimeout(500)

  /* Les marqueurs sont des noms de modules et pas le mot « convex » : le
     chemin du dépôt lui-même peut le contenir, et un filtre trop large a déjà
     compté `vite/dist/client/env.mjs` comme une fuite. `lib/convex.ts` est
     demandé et doit l'être — il ne porte que la constante ; ce qui ne doit pas
     l'être, c'est ce qu'elle garde. */
  const sdk = [
    'convex-client', // l'instance `ConvexReactClient`
    'cloud-bridge', // le fournisseur React et sa sentinelle
    'node_modules/convex/',
    'node_modules/@convex-dev/',
    'deps/convex',
  ]
  expect(requested.filter((url) => sdk.some((marker) => url.includes(marker)))).toEqual([])
})
