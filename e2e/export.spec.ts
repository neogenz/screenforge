import { test, expect } from '@playwright/test'
import JSZip from 'jszip'
import { addDeviceLayer, addTextLayer, waitForApp } from './helpers'

/**
 * Critical path: exported PNGs must be pixel-exact for App Store Connect.
 */
test.describe('export', () => {
  test('ZIP contains a pixel-exact 1320×2868 opaque RGB PNG', async ({ page }) => {
    await waitForApp(page)
    await addDeviceLayer(page)
    await addTextLayer(page)

    await page.locator('button[aria-label="Ouvrir l’export"]').click()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.locator('button', { hasText: 'Exporter le ZIP' }).click(),
    ])

    const failure = await download.failure()
    expect(failure).toBeNull()
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const zip = await JSZip.loadAsync(Buffer.concat(chunks))

    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/^6\.9\/\d{2}_[a-z0-9_]+\.png$/)

    const png = await zip.files[names[0]].async('uint8array')
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    expect(view.getUint32(16)).toBe(1320) // IHDR width
    expect(view.getUint32(20)).toBe(2868) // IHDR height
    expect(view.getUint8(24)).toBe(8) // bit depth
    expect(view.getUint8(25)).toBe(2) // color type RGB (opaque)
  })
})
