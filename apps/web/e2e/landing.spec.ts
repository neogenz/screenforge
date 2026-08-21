import { expect, test } from '@playwright/test'

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
