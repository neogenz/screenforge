import { test, expect } from '@playwright/test'
import {
  activeObjectState,
  addDeviceLayer,
  addScreen,
  dragControl,
  expectClose,
  layerRows,
  objectStates,
  waitForApp,
} from './helpers'

test.describe('shared (layout) layers', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('selecting a shared layer gives one control box, not a union', async ({ page }) => {
    await addDeviceLayer(page)
    await addScreen(page)
    // Back to screen 1, reselect, share.
    await page.locator('button[aria-label^="Activer"]').first().click()
    await page.waitForTimeout(600)
    await layerRows(page).first().click()
    await page.locator('button', { hasText: 'Partager partout' }).click()
    await page.waitForTimeout(600)

    const state = await activeObjectState(page)
    expect(state).not.toBeNull()
    expect(state!.isActiveSelection).toBe(false)
  })

  test('rotating a shared layer stays stable and mirrors all screens', async ({ page }) => {
    await addDeviceLayer(page)
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await page.waitForTimeout(600)
    await layerRows(page).first().click()
    await page.locator('button', { hasText: 'Partager partout' }).click()
    await page.waitForTimeout(600)

    await dragControl(page, 'mtr', 50, 0)
    const immediate = await activeObjectState(page)
    await page.waitForTimeout(900)
    const settled = await activeObjectState(page)

    expect(immediate!.angle).toBeGreaterThan(3)
    expectClose(settled!.angle, immediate!.angle, 0.5)
    expectClose(settled!.left, immediate!.left, 0.5)
    expectClose(settled!.top, immediate!.top, 0.5)

    // Every screen instance mirrors the same angle.
    const instances = await objectStates(page, 'device-frame')
    expect(instances.length).toBe(2)
    for (const instance of instances) {
      expectClose(instance.angle, settled!.angle, 0.5)
    }
  })
})
