import { expect, test } from '@playwright/test'

test('la landing présente Local gratuit et Cloud payant en anglais et en français', async ({
  page,
}) => {
  await page.goto('/landing.html')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Store screenshots')
  await page.getByRole('tab', { name: 'Export' }).click()
  await expect(page.getByText('6.9/', { exact: true })).toBeVisible()
  await expect(page.getByText('phone/', { exact: true })).toBeVisible()
  await expect(page.getByText('1320 × 2868', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1080 × 1920', { exact: true }).first()).toBeVisible()
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('captures de store')
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
