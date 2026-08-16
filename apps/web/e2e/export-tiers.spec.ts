import { expect, test, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import JSZip from 'jszip'
import { addDeviceLayer, readDownload, waitForApp } from './helpers'

async function exportLocalZip(page: Page): Promise<JSZip> {
  await page.getByLabel('Ouvrir l’export').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  await page.getByRole('button', { name: 'Annuler' }).click()
  return await JSZip.loadAsync(await readDownload(download))
}

test.describe('Local gratuit à l’export', () => {
  test.setTimeout(180_000)

  test('exporte quatre ZIP propres sans compte, compteur ni appel Cloud', async ({ page }) => {
    const remoteRequests: string[] = []
    page.on('request', (request) => {
      if (['fetch', 'xhr', 'websocket'].includes(request.resourceType())) {
        remoteRequests.push(request.url())
      }
    })

    await waitForApp(page)
    await addDeviceLayer(page)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const zip = await exportLocalZip(page)
      const entry = Object.values(zip.files).find((file) => !file.dir)
      expect(entry).toBeDefined()
      const png = decode(await entry!.async('uint8array'))
      expect({
        width: png.width,
        height: png.height,
        depth: png.depth,
        channels: png.channels,
      }).toEqual({ width: 1320, height: 2868, depth: 8, channels: 3 })
    }

    await page.getByLabel('Ouvrir l’export').click()
    await expect(page.getByText(/essai|filigrane|restant|sur 3/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exporter le ZIP' })).toBeEnabled()
    expect(remoteRequests.filter((url) => /convex|entitlements|\/me(?:\?|$)/i.test(url))).toEqual(
      [],
    )
  })
})
