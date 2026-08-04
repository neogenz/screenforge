import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addDeviceLayer, waitForApp, waitForCanvasSettled } from './helpers'

/**
 * Le recadrage au redimensionnement.
 *
 * Le `ResizeObserver` ajustait les dimensions du canvas sans toucher à la
 * transformation de viewport, calculée pour l'ancienne taille : les planches
 * dérivaient hors de la zone libre sans que rien ne le rattrape.
 */

/** Insets d'îlots, `src/lib/stage.ts`. Le test les répète pour rester lisible. */
const ISLAND_MARGIN = 12
const TOP_BAR_HEIGHT = 50
const FILMSTRIP_HEIGHT = 142
const DRAWER_WIDTH_LAYERS = 280
const DRAWER_WIDTH_PROPS = 320

/**
 * Rectangle occupé par les planches, en pixels d'écran.
 *
 * `getBoundingRect()` répond dans l'espace des objets : sans la transformation
 * de viewport, on mesurerait la scène et non ce qui est affiché.
 */
async function artboardRect(page: Page) {
  return page.evaluate(() => {
    const canvas = window.__sfCanvas
    if (!canvas) return null
    const boards = canvas.getObjects()
      .filter((object) => (object as { data?: { rendererType?: string } }).data?.rendererType === 'background')
      .map((object) => object.getBoundingRect())
    if (boards.length === 0) return null
    const [zoom, , , , panX, panY] = canvas.viewportTransform
    return {
      left: Math.min(...boards.map((b) => b.left)) * zoom + panX,
      top: Math.min(...boards.map((b) => b.top)) * zoom + panY,
      right: Math.max(...boards.map((b) => b.left + b.width)) * zoom + panX,
      bottom: Math.max(...boards.map((b) => b.top + b.height)) * zoom + panY,
      zoom: canvas.getZoom(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    }
  })
}

/**
 * La zone libre entre les îlots, celle que l'ajustement vise. Les drawers sont
 * ouverts par défaut, donc leur largeur en fait partie.
 */
function freeStage(rect: { canvasWidth: number; canvasHeight: number }) {
  return {
    left: ISLAND_MARGIN * 2 + DRAWER_WIDTH_LAYERS,
    right: rect.canvasWidth - ISLAND_MARGIN * 2 - DRAWER_WIDTH_PROPS,
    top: TOP_BAR_HEIGHT + ISLAND_MARGIN * 2,
    bottom: rect.canvasHeight - FILMSTRIP_HEIGHT - ISLAND_MARGIN * 2,
  }
}

test('keeps the artboards inside the free stage when the window is resized', async ({ page }) => {
  await waitForApp(page)
  await addDeviceLayer(page)
  await waitForCanvasSettled(page)

  for (const size of [{ width: 1100, height: 720 }, { width: 1800, height: 1100 }]) {
    await page.setViewportSize(size)
    // Le recadrage passe par un `ResizeObserver` débattu à 80ms.
    await expect.poll(async () => (await artboardRect(page))?.canvasWidth, { timeout: 5_000 })
      .toBeGreaterThan(0)
    await page.waitForTimeout(400)

    const rect = await artboardRect(page)
    expect(rect, `artboard absent à ${size.width}×${size.height}`).not.toBeNull()
    if (!rect) return
    const free = freeStage(rect)

    const centerX = (rect.left + rect.right) / 2
    const centerY = (rect.top + rect.bottom) / 2
    // Centré, à un pixel de tolérance : c'est ce que le recadrage promet, et
    // « intersecte encore » laisserait passer une planche à moitié sortie.
    expect(Math.abs(centerX - (free.left + free.right) / 2)).toBeLessThanOrEqual(1)
    expect(Math.abs(centerY - (free.top + free.bottom) / 2)).toBeLessThanOrEqual(1)
    expect(rect.left).toBeGreaterThanOrEqual(free.left - 1)
    expect(rect.right).toBeLessThanOrEqual(free.right + 1)
  }
})

test('preserves a hand-set zoom while the content still fits', async ({ page }) => {
  await waitForApp(page)
  await addDeviceLayer(page)
  await waitForCanvasSettled(page)

  // Un zoom volontairement plus petit que l'ajustement : le contenu tient
  // largement, rien ne justifie de le réécrire.
  await page.evaluate(() => window.__sfStores?.useUIStore.getState().setZoom(0.2))
  await page.waitForTimeout(300)
  const before = await artboardRect(page)
  expect(before).not.toBeNull()

  await page.setViewportSize({ width: 1500, height: 950 })
  await page.waitForTimeout(500)

  const after = await artboardRect(page)
  expect(after).not.toBeNull()
  if (!before || !after) return
  expect(after.zoom).toBeCloseTo(before.zoom, 2)
})
