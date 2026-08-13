import { expect, test } from '@playwright/test'
import { addTextLayer, layerRows, waitForApp } from './helpers'

/**
 * La liste des calques tient le modèle que son rôle annonce.
 *
 * `role="listbox"` promet un widget pilotable : un seul arrêt de Tab, des
 * flèches qui déplacent le focus, ⇧ qui étend. Jusqu'ici chaque ligne était un
 * arrêt et les flèches étaient avalées par la garde globale du canvas.
 */

async function addThreeLayers(page: Parameters<typeof addTextLayer>[0]) {
  await addTextLayer(page)
  await addTextLayer(page)
  await addTextLayer(page)
  await expect(layerRows(page)).toHaveCount(3)
}

test.describe('listbox des calques', () => {
  test('un seul arrêt de Tab, ↑↓ déplacent le focus, ⇧↑↓ étend la sélection', async ({ page }) => {
    await waitForApp(page)
    await addThreeLayers(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    const rows = layerRows(page)
    const tabStops = await rows.evaluateAll(
      (elements) => elements.filter((element) => element.tabIndex === 0).length,
    )
    expect(tabStops, 'une seule ligne ne doit être atteignable par Tab').toBe(1)

    // Le focus entre sur la ligne roving, puis ↓ passe à la suivante.
    await rows.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(1)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(2)).toBeFocused()
    // En bas de liste, ↓ ne bouge plus.
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(2)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(rows.first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(rows.nth(2)).toBeFocused()

    /* ⇧↑ étend depuis l'ancre (la ligne courante) : deux lignes retenues, la
       troisième reste dehors. */
    await page.keyboard.press('Shift+ArrowUp')
    const selected = await page.evaluate(
      () => window.__sfStores?.useCanvasStore.getState().selectedLayerIds.length ?? 0,
    )
    expect(selected).toBe(2)
    await page.keyboard.press('Shift+ArrowUp')
    expect(
      await page.evaluate(
        () => window.__sfStores?.useCanvasStore.getState().selectedLayerIds.length ?? 0,
      ),
    ).toBe(3)
  })

  test('Entrée sélectionne la ligne focalisée, le nudge canvas reste intact hors liste', async ({
    page,
  }) => {
    await waitForApp(page)
    await addThreeLayers(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    const rows = layerRows(page)
    await rows.first().focus()
    await page.keyboard.press('Enter')
    expect(
      await page.evaluate(
        () => window.__sfStores?.useCanvasStore.getState().selectedLayerIds.length ?? 0,
      ),
    ).toBe(1)

    /* Le focus reparti hors de la liste (sans clic, qui désélectionnerait),
       les flèches redeviennent le nudge : la garde ne doit avaler les flèches
       que pour les rôles composites. */
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })
    const xBefore = await page.evaluate(() => {
      const id = window.__sfStores?.useCanvasStore.getState().selectedLayerIds[0]
      return window.__sfStores?.useProjectStore
        .getState()
        .project?.screens.flatMap((screen) => screen.layers)
        .find((layer) => layer.id === id)?.x
    })
    await page.keyboard.press('ArrowRight')
    const xAfter = await page.evaluate(() => {
      const id = window.__sfStores?.useCanvasStore.getState().selectedLayerIds[0]
      return window.__sfStores?.useProjectStore
        .getState()
        .project?.screens.flatMap((screen) => screen.layers)
        .find((layer) => layer.id === id)?.x
    })
    expect(xAfter).toBe((xBefore ?? 0) + 1)
  })

  test('le menu contextuel rend le focus à la ligne', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    const row = layerRows(page).first()
    await row.click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(row).toBeFocused()
  })
})
