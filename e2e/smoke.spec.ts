import { test, expect } from '@playwright/test'
import {
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  layerRows,
  waitForApp,
} from './helpers'

test.describe('smoke', () => {
  test('app loads and project name is editable', async ({ page }) => {
    await waitForApp(page)
    const nameInput = page.locator('input[aria-label="Nom du projet"]')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Mon app')
    await nameInput.press('Enter')
    await expect(nameInput).toHaveValue('Mon app')
  })

  test('all layer types can be added and undone', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addShapeLayer(page)
    await addDeviceLayer(page)
    await expect(layerRows(page)).toHaveCount(3)

    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(400)
    await expect(layerRows(page)).toHaveCount(2)
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForTimeout(400)
    await expect(layerRows(page)).toHaveCount(3)
  })

  test('screens can be added, duplicated and deleted', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addScreen(page)
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(2)

    // Duplicate screen 1 via its context menu.
    await page.locator('button[aria-label^="Activer"]').first().click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Dupliquer' }).click()
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(3)

    // Delete the duplicate.
    await page.locator('button[aria-label^="Activer"]').nth(1).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(2)
  })

  test('export dialog opens with App Store dimensions', async ({ page }) => {
    await waitForApp(page)
    await page.locator('button[aria-label="Ouvrir l’export"]').click()
    await expect(page.locator('text=1320').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})
