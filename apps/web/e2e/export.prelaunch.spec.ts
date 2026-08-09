import { expect, test } from '@playwright/test'
import { decode } from 'fast-png'
import JSZip from 'jszip'
import { readDownload, waitForApp } from './helpers'

const SCALE = 1320 / 440
const WATERMARK_ROW = Math.round((956 - 26) * SCALE)
const NEUTRAL_ROW = Math.round(956 * 0.1 * SCALE)

function row(png: ReturnType<typeof decode>, y: number): Uint8Array {
  const start = y * png.width * png.channels
  return Uint8Array.from(png.data.slice(start, start + png.width * png.channels))
}

test('avant le billing, la landing annonce le produit entier et des notifications', async ({
  page,
}) => {
  await page.goto('/landing.html')

  await expect(page.getByText('Not open yet').first()).toBeVisible()
  await expect(page.getByText('Unlimited clean exports and grouped ZIP').first()).toBeVisible()
  await expect(page.getByText('The paid plans are open')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Get notified at launch (Licence)' }),
  ).toHaveAttribute('href', /^mailto:hello@screenforge\.app/)
})

test('avant le billing, exporte un ZIP propre et illimité comme annoncé', async ({ page }) => {
  await waitForApp(page)
  const projectId = await page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.id,
  )
  expect(projectId).toBeTruthy()
  await page.evaluate((id) => {
    localStorage.setItem('screenforge-exports', JSON.stringify({ [String(id)]: 99 }))
  }, projectId)

  await page.getByLabel('Ouvrir l’export').click()
  await expect(page.getByText('Palier gratuit')).toHaveCount(0)
  await expect(page.getByText('Filigrane « Fait avec ScreenForge »')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exporter le ZIP' })).toBeEnabled()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
  ])
  const zip = await JSZip.loadAsync(await readDownload(download))
  const entry = Object.values(zip.files).find((file) => !file.dir)
  expect(entry).toBeTruthy()
  const png = decode(await entry!.async('uint8array'))
  expect(row(png, WATERMARK_ROW)).toEqual(row(png, NEUTRAL_ROW))
})
