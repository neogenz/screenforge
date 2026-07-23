import { test, expect } from '@playwright/test'
import { addDeviceLayer, addTextLayer, findObject, waitForApp, type DebugObject } from './helpers'

test.describe('canvas text editing', () => {
  test('double-click edits text on canvas and persists to the store', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)

    const center = await page.evaluate(() => {
      const canvas = window.__sfCanvas
      const object = (canvas?.getObjects() ?? [])
        .find((candidate) => (candidate as DebugObject).data?.rendererType === 'text')
      if (!canvas || !object) return null
      const rect = canvas.upperCanvasEl.getBoundingClientRect()
      const viewport = canvas.viewportTransform
      const c = object.getCenterPoint()
      return { x: rect.left + c.x * viewport[0] + viewport[4], y: rect.top + c.y * viewport[3] + viewport[5] }
    })
    expect(center).not.toBeNull()
    await page.mouse.dblclick(center!.x, center!.y)
    await page.waitForTimeout(400)
    await page.keyboard.press('Meta+a')
    await page.keyboard.type('Nouveau titre')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)

    const object = await findObject(page, 'text')
    expect(object?.text).toBe('Nouveau titre')
    // The properties panel reflects the edited content.
    await expect(page.locator('textarea', { hasText: 'Nouveau titre' })).toHaveCount(1)
  })
})

test.describe('device screenshot import', () => {
  test('importing a PNG places it inside the device frame', async ({ page }) => {
    await waitForApp(page)
    await addDeviceLayer(page)

    // 100×200 red PNG generated on the fly.
    const pngBase64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 100, 200)
      return canvas.toDataURL('image/png').split(',')[1]
    })

    const fileInput = page.locator('input[type="file"][accept*="png"]').first()
    await fileInput.setInputFiles({
      name: 'capture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64'),
    })
    await page.waitForTimeout(1200)

    const object = await findObject(page, 'device-frame')
    // resourceKey embeds model, color, orientation and the screenshot URL.
    expect((object?.data?.resourceKey ?? '').split(':').length).toBeGreaterThanOrEqual(4)
    expect(object?.data?.resourceKey).not.toContain('::')
  })
})
