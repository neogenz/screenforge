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

  // Inter est auto-hébergée : aucune feuille tierce, donc rien à sortir du
  // chemin critique.
  expect(html).not.toContain('fonts.googleapis.com')
  expect(html).not.toMatch(/\son[a-z]+\s*=/i)

  // Le thème vit dans un script same-origin, avant les styles du boot : aucune
  // permission `unsafe-inline` n'est requise.
  const boot = await (await request.get('/boot.js')).text()
  expect(boot).toContain("localStorage.getItem('screenforge-theme')")
  expect(html.indexOf('<script src="/boot.js"></script>')).toBeLessThan(html.indexOf('<style>'))

  // Une fois monté, React a vidé le conteneur : rien à retirer à la main.
  await waitForApp(page)
  await expect(page.locator('.boot')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'ScreenForge', level: 1 })).toBeAttached()

  // Aucune requête vers Google Fonts, et la fonte locale est bien celle qui rend.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      remote: performance
        .getEntriesByType('resource')
        .filter((entry) => /fonts\.g(oogleapis|static)\.com/.test(entry.name)).length,
      inter: document.fonts.check('14px "Inter Variable"'),
    }
  })
  expect(fonts.remote).toBe(0)
  expect(fonts.inter).toBe(true)
})

/**
 * Le bouton Exporter ne saute pas quand React remplace le squelette.
 *
 * `.boot-export` est un rectangle sans texte — le boot n'a encore ni Inter ni
 * le CSS de l'app pour mesurer « Exporter » lui-même — mais ses quatre bords
 * recopient le rendu réel à la largeur de fenêtre par défaut des tests. Les
 * deux mesures viennent de deux pages séparées : la première n'exécute jamais
 * `main.tsx` (le script est intercepté), donc le squelette reste seul à
 * l'écran le temps de la lire.
 */
test('le bouton Exporter garde sa position entre le squelette et l’hydratation', async ({
  page,
  browser,
}) => {
  await page.route('**/src/main.tsx*', (route) => route.abort())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const before = await page.locator('.boot-export').boundingBox()
  expect(before).not.toBeNull()

  const hydrated = await browser.newPage()
  await waitForApp(hydrated)
  const after = await hydrated.locator('button[aria-label="Ouvrir l’export"]').boundingBox()
  await hydrated.close()
  expect(after).not.toBeNull()

  if (!before || !after) return
  expect(Math.abs(before.x - after.x)).toBeLessThan(1)
  expect(Math.abs(before.y - after.y)).toBeLessThan(1)
  expect(Math.abs(before.width - after.width)).toBeLessThan(1)
  expect(Math.abs(before.height - after.height)).toBeLessThan(1)
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
      light: !document.documentElement.classList.contains('dark'),
      background: root.backgroundColor,
      ink: boot.color,
      /* Les deux valeurs recopient `--color-background`, pas `--color-stage` :
         le boot peint ce que le chrome peindra en premier au montage, sinon un
         boot plus sombre que l'application se lit comme un double flash. */
      expectedBackground: resolveColor(
        document.documentElement.classList.contains('dark') ? '#161616' : '#fff',
      ),
      expectedInk: resolveColor(
        document.documentElement.classList.contains('dark') ? '#818181' : '#686868',
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
test('sans services configurés, aucun SDK distant n’est demandé au réseau', async ({ page }) => {
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
    'posthog-js',
    '/posthog/',
  ]
  expect(requested.filter((url) => sdk.some((marker) => url.includes(marker)))).toEqual([])
  await expect(page.getByRole('button', { name: 'Préférences de confidentialité' })).toHaveCount(0)
})
