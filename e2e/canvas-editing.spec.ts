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
    await expect.poll(() => page.evaluate(() =>
      Boolean((window.__sfCanvas?.getActiveObject() as DebugObject | undefined)?.isEditing),
    )).toBe(true)
    await page.keyboard.press('Meta+a')
    await page.keyboard.type('Nouveau titre')
    await page.keyboard.press('Escape')
    await expect.poll(async () => (await findObject(page, 'text'))?.text).toBe('Nouveau titre')
    // The properties panel reflects the edited content.
    await expect(page.locator('textarea', { hasText: 'Nouveau titre' })).toHaveCount(1)
  })

  test('loads and exposes the exact maximum Poppins weight', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)

    await page.getByRole('button', { name: /^Police :/ }).click()
    await page.getByRole('searchbox', { name: 'Rechercher une police' }).fill('Poppins')
    await page.getByRole('option', { name: 'Poppins' }).click()

    const weight = page.getByRole('combobox', { name: 'Graisse de la police' })
    await weight.click()
    await page.getByRole('option', { name: '900 · Black' }).click()
    await expect(weight).toContainText('900 · Black')
    await expect.poll(() => page.locator('link[data-font-key="Poppins:900"]').count()).toBe(1)
  })

  test('does not cache a partially loaded multi-weight request', async ({ page }) => {
    await waitForApp(page)
    const result = await page.evaluate(async () => {
      const family = `Partial Load ${Date.now()}`
      const key = `${family}:400,900`
      const link = document.createElement('link')
      link.dataset.fontKey = key
      Object.defineProperty(link, 'sheet', { value: {} as CSSStyleSheet })
      document.head.appendChild(link)

      const originalLoad = document.fonts.load.bind(document.fonts)
      document.fonts.load = (font: string) => Promise.resolve(
        font.startsWith('400 ') ? [{} as FontFace] : [],
      )
      try {
        const moduleUrl = new URL('/src/lib/fonts.ts', window.location.href).href
        const fonts = await import(/* @vite-ignore */ moduleUrl) as typeof import('../src/lib/fonts')
        const load = await fonts.loadGoogleFont(family, ['400', '900'])
        return {
          status: load.status,
          loaded400: fonts.isFontLoaded(family, ['400']),
          loaded900: fonts.isFontLoaded(family, ['900']),
        }
      } finally {
        document.fonts.load = originalLoad
        link.remove()
      }
    })

    expect(result).toEqual({ status: 'fallback', loaded400: false, loaded900: false })
  })
})

test.describe('angle controls', () => {
  test('fills segmented tabs and applies cardinal gradient and layer angles', async ({ page }) => {
    await waitForApp(page)

    const backgroundTabs = page.getByRole('group', { name: 'Type d’arrière-plan' })
    const tabsBox = await backgroundTabs.boundingBox()
    const lastTabBox = await backgroundTabs.getByRole('button', { name: 'Préréglages' }).boundingBox()
    expect(tabsBox).not.toBeNull()
    expect(lastTabBox).not.toBeNull()
    expect(Math.abs((tabsBox!.x + tabsBox!.width) - (lastTabBox!.x + lastTabBox!.width))).toBeLessThan(6)

    await backgroundTabs.getByRole('button', { name: 'Dégradé' }).click()
    const gradientAngle = page.getByRole('slider', { name: 'Angle du dégradé' })
    await page.getByRole('group', { name: 'Angle du dégradé — angles principaux' })
      .getByRole('button', { name: '270°' })
      .click()
    await expect(gradientAngle).toHaveAttribute('aria-valuenow', '270')

    await addTextLayer(page)
    const rotation = page.getByRole('slider', { name: 'Rotation' })
    await page.getByRole('switch', { name: 'Activer le dégradé du texte' }).click()
    await expect(page.getByRole('group', { name: 'Rotation — angles principaux' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Angle du dégradé — angles principaux' })).toBeVisible()
    await page.getByRole('group', { name: 'Rotation — angles principaux' })
      .getByRole('button', { name: '90°' })
      .click()
    await expect(rotation).toHaveAttribute('aria-valuenow', '90')
    await expect.poll(async () => (await findObject(page, 'text'))?.angle).toBe(90)
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

    const fileInput = page.getByLabel('Importer la capture de l’app')
    const previousResource = (await findObject(page, 'device-frame'))?.data?.resourceKey
    await fileInput.setInputFiles({
      name: 'capture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64'),
    })
    await expect.poll(async () => (await findObject(page, 'device-frame'))?.data?.resourceKey)
      .not.toBe(previousResource)

    const object = await findObject(page, 'device-frame')
    // resourceKey embeds model, color, orientation and the screenshot URL.
    expect((object?.data?.resourceKey ?? '').split(':').length).toBeGreaterThanOrEqual(4)
    expect(object?.data?.resourceKey).not.toContain('::')
  })
})
