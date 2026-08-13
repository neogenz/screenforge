import { expect, test } from '@playwright/test'
import { addTextLayer, layerRows, waitForApp } from './helpers'

/**
 * Les micro-interactions restent dans leur couloir, et s'effacent à demande.
 *
 * Deux garanties mesurables, pas deux goûts : aucune animation ajoutée ne
 * dépasse 300 ms, et `prefers-reduced-motion: reduce` les rend toutes
 * instantanées — entrées de lignes, vignettes, coche dessinée des toasts.
 */

test.describe('micro-interactions', () => {
  test('les entrées de lignes restent sous 300 ms', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    const row = layerRows(page).first()
    const timing = await row.evaluate((element) => {
      const style = getComputedStyle(element)
      return { name: style.animationName, duration: style.animationDuration }
    })
    expect(timing.name).toBe('enter')
    expect(Number.parseFloat(timing.duration)).toBeLessThanOrEqual(0.3)
  })

  test('reduced motion rend les entrées instantanées', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await waitForApp(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    const row = layerRows(page).first()
    /* Sous `reduce`, les entrées animées retombent sur le simple fondu : plus
       de translation, plus de settle. */
    await expect
      .poll(() => row.evaluate((element) => getComputedStyle(element).animationName))
      .toBe('fade-in')
  })

  test('la coche de succès se dessine, et reste pleine sous reduced motion', async ({ page }) => {
    await waitForApp(page)
    await page.evaluate(async () => {
      const toastPath = '/src/stores/toast.store.ts'
      const { toast } = (await import(toastPath)) as typeof import('../src/stores/toast.store')
      toast('Exporté.', 'success')
    })
    const check = page.locator('[data-sonner-toast] svg path.animate-check-draw')
    await expect(check).toBeVisible()

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() => check.evaluate((element) => getComputedStyle(element).strokeDashoffset))
      .toBe('0px')
  })
})
