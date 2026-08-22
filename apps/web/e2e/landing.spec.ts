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
