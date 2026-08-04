import { expect, test } from '@playwright/test'
import { addTextLayer, layerRows, waitForApp } from './helpers'

test.describe('command palette', () => {
  test('opens with ⌘K, filters and runs a command', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+k')
    const dialog = page.getByRole('dialog', { name: 'Palette de commandes' })
    await expect(dialog).toBeVisible()

    await page.keyboard.type('texte')
    const option = dialog.getByRole('option', { name: 'Ajouter un texte' })
    await expect(option).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(layerRows(page)).toHaveCount(1)
    await expect(layerRows(page).first()).toContainText('Texte')
  })

  test('Escape closes the palette', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+k')
    const dialog = page.getByRole('dialog', { name: 'Palette de commandes' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('history coalescing', () => {
  test('a burst of arrow nudges is a single undo step', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)

    const pastBefore = await page.evaluate(
      () => window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
    )
    const xBefore = await page.evaluate(
      () => window.__sfStores?.useCanvasStore.getState().layers[0]?.x ?? -1,
    )
    expect(xBefore).toBeGreaterThanOrEqual(0)

    // Burst: 5 nudges well inside the 1200ms coalesce window.
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)

    const pastAfterBurst = await page.evaluate(
      () => window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
    )
    expect(pastAfterBurst).toBe(pastBefore + 1)

    // After the window expires, the next nudge starts a new entry.
    await page.waitForTimeout(1400)
    await page.keyboard.press('ArrowRight')
    const pastLater = await page.evaluate(
      () => window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
    )
    expect(pastLater).toBe(pastBefore + 2)

    // Undo the last single nudge, then ONE undo reverts the whole burst.
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(400)
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(400)
    const xAfterUndos = await page.evaluate(
      () => window.__sfStores?.useCanvasStore.getState().layers[0]?.x ?? -1,
    )
    expect(xAfterUndos).toBe(xBefore)
  })
})
