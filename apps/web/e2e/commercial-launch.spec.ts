import { expect, test } from '@playwright/test'

test('la landing lancée présente les paliers actifs et ouvre les offres de l’éditeur', async ({
  page,
}) => {
  await page.goto('/landing.html')

  await expect(page.getByText('The paid plans are open')).toBeVisible()
  await expect(page.getByText('Not open yet')).toHaveCount(0)
  await expect(page.getByText('3 exports per project, watermarked').first()).toBeVisible()
  await page.getByText('What happens if I stop paying for Cloud?').click()
  await expect(
    page.getByText(
      'The copies already present on your machines stay local, editable, and exportable because your Licence does not expire. You only lose the cloud mirror and multi-machine pickup.',
    ),
  ).toBeVisible()

  const licence = page.getByRole('link', { name: 'Buy the Licence (Licence)' })
  await expect(licence).toHaveAttribute('href', '/?offers=open')
  await licence.click()

  await expect(page.getByRole('heading', { name: 'Offres ScreenForge' })).toBeVisible()
  await expect(page).not.toHaveURL(/offers=open/)
})
