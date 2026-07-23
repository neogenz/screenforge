import { test, expect } from '@playwright/test'
import {
  addDeviceLayer,
  addShapeLayer,
  addTextLayer,
  findObject,
  layerRows,
  waitForApp,
} from './helpers'

test.describe('layers panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('context menu duplicates and deletes a layer', async ({ page }) => {
    await addTextLayer(page)
    await expect(layerRows(page)).toHaveCount(1)

    // Duplicate via right-click menu.
    await layerRows(page).first().click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Dupliquer' }).click()
    await expect(layerRows(page)).toHaveCount(2)
    await expect(layerRows(page).filter({ hasText: 'copie' })).toHaveCount(1)

    // Delete the copy via right-click menu.
    await layerRows(page).filter({ hasText: 'copie' }).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(layerRows(page)).toHaveCount(1)
  })

  test('cmd-click toggles multi-selection, menu acts on all selected', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    await expect(layerRows(page)).toHaveCount(2)

    await layerRows(page).nth(0).click()
    await layerRows(page).nth(1).click({ modifiers: ['Meta'] })
    await expect(page.locator('[data-layer-id][aria-selected="true"]')).toHaveCount(2)

    await layerRows(page).nth(1).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(layerRows(page)).toHaveCount(0)
  })

  test('double-click renames a layer', async ({ page }) => {
    await addTextLayer(page)
    await layerRows(page).first().dblclick()
    const input = page.locator('[data-layer-id] input')
    await input.fill('Titre principal')
    await input.press('Enter')
    await expect(layerRows(page).first()).toContainText('Titre principal')
  })

  test('visibility toggle hides the layer on canvas', async ({ page }) => {
    await addDeviceLayer(page)
    const row = layerRows(page).first()
    await row.hover()
    await row.locator('button[aria-label="Masquer le calque"]').click()
    await page.waitForTimeout(500)
    const object = await findObject(page, 'device-frame')
    expect(object?.visible).toBe(false)
  })
})
