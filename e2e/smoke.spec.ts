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
    await expect(layerRows(page)).toHaveCount(2)
    await page.keyboard.press('Meta+Shift+z')
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

  test('screen settings can be copied, pasted and undone without replacing layers', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addScreen(page)
    await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const sourceId = project?.screens[0]?.id
      if (!sourceId) throw new Error('source screen missing')
      window.__sfStores?.useProjectStore.getState().updateScreenBackground(sourceId, {
        type: 'linear-gradient',
        angle: 270,
        stops: [
          { offset: 0, color: '#101010' },
          { offset: 1, color: '#f0f0f0' },
        ],
      })
    })

    const screens = page.locator('button[aria-label^="Activer"]')
    await screens.first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Copier les réglages' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Réglages de Écran 1 copiés' })).toBeVisible()

    await screens.nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Coller les réglages' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Réglages appliqués à Écran 2' })).toBeVisible()

    const pasted = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        source: project?.screens[0]?.background,
        target: project?.screens[1]?.background,
        sourceLayerCount: project?.screens[0]?.layers.length,
        targetLayerCount: project?.screens[1]?.layers.length,
      }
    })
    expect(pasted.target).toEqual(pasted.source)
    expect(pasted).toMatchObject({ sourceLayerCount: 1, targetLayerCount: 0 })

    await page.keyboard.press('Meta+z')
    await expect.poll(async () => page.evaluate(() =>
      window.__sfStores?.useProjectStore.getState().project?.screens[1]?.background.type,
    )).toBe('solid')
  })

  test('background gestures keep independent undo steps', async ({ page }) => {
    await waitForApp(page)
    await page.getByRole('group', { name: 'Type d’arrière-plan' })
      .getByRole('button', { name: 'Dégradé' })
      .click()

    const angle = page.getByRole('slider', { name: 'Angle du dégradé' })
    await angle.focus()
    await angle.press('ArrowRight')
    await angle.press('ArrowRight')
    await expect(angle).toHaveAttribute('aria-valuenow', '137')
    await expect.poll(() => page.evaluate(() =>
      window.__sfStores?.useHistoryStore.getState().past.length,
    )).toBe(2)

    await page.keyboard.press('Meta+z')
    await expect(angle).toHaveAttribute('aria-valuenow', '135')
    await page.keyboard.press('Meta+z')
    await expect(page.getByRole('group', { name: 'Type d’arrière-plan' })
      .getByRole('button', { name: 'Uni' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('export dialog opens with App Store dimensions', async ({ page }) => {
    await waitForApp(page)
    await page.locator('button[aria-label="Ouvrir l’export"]').click()
    await expect(page.locator('text=1320').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})
