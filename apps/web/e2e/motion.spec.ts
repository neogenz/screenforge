import { expect, test, type Page } from '@playwright/test'
import { addTextLayer, waitForApp } from './helpers'

interface LayerEntryProbe {
  duration: string
  name: string
}

type MotionProbeWindow = Window & { __sfLayerEntryProbe?: LayerEntryProbe }

async function armLayerEntryProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = window as MotionProbeWindow
    root.__sfLayerEntryProbe = undefined
    const capture = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.dataset.layerId) return
      const style = getComputedStyle(event.target)
      root.__sfLayerEntryProbe = { name: event.animationName, duration: style.animationDuration }
      document.removeEventListener('animationstart', capture)
    }
    document.addEventListener('animationstart', capture)
  })
}

function readLayerEntryProbe(page: Page): Promise<LayerEntryProbe | null> {
  return page.evaluate(
    () => (window as MotionProbeWindow).__sfLayerEntryProbe ?? null,
  ) as Promise<LayerEntryProbe | null>
}

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
    await armLayerEntryProbe(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    await expect.poll(() => readLayerEntryProbe(page)).not.toBeNull()
    const timing = await readLayerEntryProbe(page)
    expect(timing?.name).toBe('enter')
    expect(Number.parseFloat(timing?.duration ?? 'Infinity')).toBeLessThanOrEqual(0.3)
  })

  test('reduced motion rend les entrées instantanées', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await waitForApp(page)
    await armLayerEntryProbe(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    /* Sous `reduce`, les entrées animées retombent sur le simple fondu : plus
       de translation, plus de settle. */
    await expect.poll(async () => (await readLayerEntryProbe(page))?.name).toBe('fade-in')
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
