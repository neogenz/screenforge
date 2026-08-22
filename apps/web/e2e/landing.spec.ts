import { expect, test, type Page } from '@playwright/test'

/* `landing.css` déclare `scroll-behavior: smooth` : un `scrollIntoView` anime,
   donc la position n'est pas acquise au retour de `evaluate` et toute mesure
   qui suit lit la page d'avant. On pose la position, à l'instant. */
async function scrollDemoIntoView(page: Page) {
  await page.evaluate(() => {
    const rect = document.querySelector('.demo-stage')?.getBoundingClientRect()
    if (!rect) throw new Error('démo introuvable')
    const top = rect.top + window.scrollY - (window.innerHeight - rect.height) / 2
    window.scrollTo({ top, behavior: 'instant' })
  })
}

test('la landing présente Local gratuit et Cloud payant en anglais et en français', async ({
  page,
}) => {
  await page.goto('/landing.html')
  const pricing = page.locator('#pricing')
  await expect(pricing.getByText('$0', { exact: true })).toBeVisible()
  await expect(pricing.getByText('$39', { exact: true })).toBeVisible()
  await expect(pricing).toContainText('100 projects and 128 MiB')
  await expect(pricing).toContainText('500 images and 512 MiB')
  await expect(pricing.getByRole('link', { name: 'Open the editor (Local)' })).toHaveAttribute(
    'href',
    '/',
  )
  await expect(pricing.getByRole('link', { name: 'Choose Cloud (Cloud)' })).toHaveAttribute(
    'href',
    '/?offers=open',
  )
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms.html')
  await expect(pricing).not.toContainText(/\$49|free trial|three watermarked/i)

  await page.getByRole('link', { name: 'Français' }).first().click()
  await expect(pricing.getByText('0 $', { exact: true })).toBeVisible()
  await expect(pricing.getByText('39 $', { exact: true })).toBeVisible()
  await expect(pricing).toContainText('100 projets et 128 Mio')
  await expect(pricing).toContainText('500 images et 512 Mio')
  await expect(page.getByText('Local est-il vraiment gratuit ?')).toBeVisible()
  await expect(pricing).not.toContainText(/49 \$|essai gratuit|trois exports filigranés/i)
})

test('un build sans Convex désactive uniquement Cloud', async ({ page }) => {
  await page.goto('/landing.html')
  await page.locator('#pricing').getByRole('link', { name: 'Choose Cloud (Cloud)' }).click()
  await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 15_000 })

  const dialog = page.getByRole('dialog', { name: 'Offres ScreenForge' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/Cloud n’est pas configuré/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Acheter Cloud' })).toBeDisabled()
  await expect(dialog.getByText('Inclus gratuitement')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Conditions ScreenForge' })).toHaveAttribute(
    'href',
    '/terms.html',
  )
  await expect(dialog.getByRole('link', { name: 'conditions acheteur Polar' })).toHaveAttribute(
    'href',
    'https://polar.sh/legal/checkout-buyer-terms',
  )
})

test('publie des conditions bilingues utilisables sans JavaScript', async ({ page }) => {
  await page.route('**/*.js', (route) => route.abort())
  await page.goto('/terms.html', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: '1. Éditeur et contact' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. Publisher and contact' })).toBeVisible()
  await expect(page.getByText('Route Cantonale 158, 1963 Vétroz, Suisse')).toBeVisible()
  await expect(page.getByText(/Cloud se renouvelle automatiquement chaque année/)).toBeVisible()
  await expect(page.getByText(/Cloud renews automatically each year/)).toBeVisible()
})

/* La décision de `2026_08_13_landing-quality` : les ancres sortent du menu dès
   que la barre a la place. Une landing à 1440 px qui range « Pricing » derrière
   un hamburger perd la visite venue comparer. */
test('la barre montre ses ancres dès qu’elle a la place, et le menu seulement sinon', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/landing.html')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Pricing', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'The editor', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Pricing', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(
    page.locator('#nav-menu').getByRole('link', { name: 'Pricing', exact: true }),
  ).toBeVisible()
})

/* La langue de l'éditeur est la seule information qui change ce que le
   visiteur anglophone vit au clic ; la page française n'a rien à en dire. */
test('la note de langue ne s’affiche que sur la page anglaise', async ({ page }) => {
  await page.goto('/landing.html')
  const hero = page.locator('#hero')
  await expect(hero.getByText('The editor is in French for now.')).toBeVisible()

  await page.getByRole('link', { name: 'Français' }).first().click()
  await expect(hero.getByText(/français pour l’instant|French for now/)).toHaveCount(0)
})

/* Deux boutons citron côte à côte, c'est zéro bouton primaire : Local est le
   plein, Cloud le contour. La couleur se lit sur la classe, la capture n'étant
   pas un test. */
test('le pricing classe ses deux actions : Local plein, Cloud en contour', async ({ page }) => {
  await page.goto('/landing.html')
  const pricing = page.locator('#pricing')
  await expect(pricing.getByRole('link', { name: 'Open the editor (Local)' })).toHaveClass(
    /bg-marker/,
  )
  await expect(pricing.getByRole('link', { name: 'Choose Cloud (Cloud)' })).not.toHaveClass(
    /bg-marker/,
  )
})

/* Un produit sans contact est un produit sans responsable. Les issues du dépôt
   ne dépendent d'aucun domaine vérifié, contrairement à une adresse. */
test('le pied de page dit comment joindre l’auteur', async ({ page }) => {
  await page.goto('/landing.html')
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    'https://github.com/neogenz/screenforge/issues',
  )
  await expect(footer.getByRole('link', { name: 'Source', exact: true })).toBeVisible()
})

/* Deux tiers de la section vivaient derrière un onglet, dans une page dont le
   travail entier est de montrer. Le prérendu est le livrable : c'est lui qui
   est lu ici. */
test('les fonctionnalités montrent leurs trois blocs sans un clic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/landing.html')
  const features = page.locator('#features')
  await expect(features.locator('h3')).toHaveCount(3)
  await expect(features.getByText('One screen, applied to ten')).toBeVisible()
  await expect(
    features.getByText('One folder in, the layout stays where you left it'),
  ).toBeVisible()
  await expect(features.getByText('What lands in your Downloads folder')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(features.locator('h3')).toHaveCount(3)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

/* La marche à suivre reste dans le DOM prérendu — la commande MCP y est lisible
   par un crawler — mais repliée : elle n'intéresse que qui va la suivre. */
test('la marche à suivre de l’agent est repliée, pas absente', async ({ page }) => {
  await page.goto('/landing.html')
  const details = page.locator('#agent details')
  await expect(details).toHaveCount(1)
  await expect(details).not.toHaveAttribute('open', /.*/)
  await expect(page.locator('#agent').getByText('pnpm --filter mcp run start')).toBeHidden()

  await details.getByRole('heading', { name: 'Connect an agent' }).click()
  await expect(page.locator('#agent').getByText('pnpm --filter mcp run start')).toBeVisible()
})

/* La démo ne commence jamais par du vide : le premier état est la planche
   finie, servie telle quelle par le prérendu. Ce que la source contient est
   vérifié par `scripts/landing-audit.mjs` sur `dist/` ; ici on mesure le même
   état sur le rendu client, avant que la boucle ait pu démarrer. */
test('la démo s’affiche composée avant d’avoir joué', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/landing.html')
  await expect(page.locator('[data-demo-tile="filled"]')).toHaveCount(10)
  await expect(page.locator('[data-cursor-target="layer-row-device"]')).toHaveCount(1)
})

/* Le seuil se mesure sous la barre fixe, pas contre la fenêtre : à 0,7 sans
   marge il fallait avoir défilé bien après l'arrivée de la section. */
test('la démo démarre quand on la regarde, et ne se vide pas si on revient', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/landing.html')
  const cursor = page.locator('[data-demo-cursor]').first()

  await page.evaluate(() => {
    const stage = document.querySelector('.demo-stage')
    if (!stage) throw new Error('démo introuvable')
    const rect = stage.getBoundingClientRect()
    /* La moitié de la démo sous la barre de 72 px. */
    const wanted = rect.top + window.scrollY + rect.height / 2 - (window.innerHeight + 72) / 2
    window.scrollTo({ top: wanted, behavior: 'instant' })
  })
  await expect(cursor).toHaveCSS('opacity', '1', { timeout: 1500 })

  /* Le retour dans le champ reprend les réglages sur la planche montée ; il
     rejouait `build()` depuis la planche vide, donc effaçait la composition
     que le visiteur venait de regarder se monter. */
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(400)
  await scrollDemoIntoView(page)
  /* Le temps que l'observateur reparte et que l'effet reprenne la main. Une
     reconstruction, elle, tiendrait la planche vide une dizaine de secondes :
     ce délai ne la masque pas, il écarte seulement l'image d'avant. */
  await page.waitForTimeout(600)
  const lowest = await page.evaluate(async () => {
    let least = Number.POSITIVE_INFINITY
    for (let i = 0; i < 30; i++) {
      least = Math.min(least, document.querySelectorAll('[data-demo-tile="filled"]').length)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return least
  })
  expect(lowest).toBeGreaterThan(0)
})

/* 24 px de haut et 10 px de texte pour la seule commande de la démo. La zone
   de frappe de 44 n'est pas mesurable par `boundingBox` — elle vit sur un
   `::after` — donc on la constate par un clic hors de la boîte visible. */
test('la pastille de la démo se vise', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/landing.html')
  await scrollDemoIntoView(page)
  const pill = page.getByRole('button', { name: 'Take over' })
  const box = await pill.boundingBox()
  if (!box) throw new Error('pastille introuvable')
  expect(box.height).toBeGreaterThanOrEqual(32)

  /* Quatre pixels au-dessus du bord visible : dans les six que `hit-44` ajoute
     de chaque côté d'une pastille de 32, et hors de la boîte peinte. */
  await page.mouse.click(box.x + box.width / 2, box.y - 4)
  await expect(page.getByRole('button', { name: 'Replay the demo' })).toBeVisible()
})
