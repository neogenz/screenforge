import { expect, test } from '@playwright/test'

test('la landing lancée présente Local et Cloud puis ouvre les offres de l’éditeur', async ({
  page,
}) => {
  await page.goto('/landing.html')

  await expect(page.getByText('The paid plans are open')).toBeVisible()
  await expect(page.getByText('Not open yet')).toHaveCount(0)
  await expect(page.getByText(/three watermarked exports per project/i).first()).toBeVisible()
  await page.getByText('What happens if I stop paying for Cloud?').click()
  await expect(
    page.getByText(
      'Copies already present on your machines stay local and editable. Your cloud data remains readable and deletable, but new sync stops. A separate Local purchase keeps clean exports and ZIP after Cloud ends.',
    ),
  ).toBeVisible()

  const local = page.getByRole('link', { name: 'Choose Local (Local)' })
  const cloud = page.getByRole('link', { name: 'Choose Cloud (Cloud)' })
  await expect(local).toHaveAttribute('href', '/?offers=open')
  await expect(cloud).toHaveAttribute('href', '/?offers=open')
  await expect(page.getByRole('link', { name: /Free|Licence/ })).toHaveCount(0)
  await local.click()

  const dialog = page.getByRole('dialog', { name: 'Offres ScreenForge' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Acheter Local' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Acheter Cloud' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Factures et abonnement' })).toHaveCount(0)
  await expect(dialog.getByText(/Licence/)).toHaveCount(0)
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  if (await dialog.isVisible()) await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).not.toHaveURL(/offers=open/)
})
