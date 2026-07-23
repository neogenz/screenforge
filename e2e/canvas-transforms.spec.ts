import { test, expect } from '@playwright/test'
import {
  activeObjectState,
  addDeviceLayer,
  addTextLayer,
  dragActiveBody,
  dragControl,
  expectClose,
  findObject,
  transformInput,
  waitForApp,
} from './helpers'

/**
 * The reported bug: selection handles drift away from the layer after
 * transforms. These specs assert the object stays stable through the full
 * canvas → store → sync round-trip (no jump after releasing the mouse).
 */

test.describe('canvas transforms', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('panel rotation keeps position and aligns controls', async ({ page }) => {
    await addDeviceLayer(page)
    const before = await activeObjectState(page)
    expect(before).not.toBeNull()

    await transformInput(page, 4).fill('30')
    await transformInput(page, 4).press('Enter')
    await page.waitForTimeout(700)

    const after = await activeObjectState(page)
    expectClose(after!.angle, 30, 0.5)
    expectClose(after!.left, before!.left, 0.5)
    expectClose(after!.top, before!.top, 0.5)
  })

  test('canvas rotation does not jump after sync', async ({ page }) => {
    await addDeviceLayer(page)
    await dragControl(page, 'mtr', 40, 0)
    // Immediately after release (pre-sync) and after the store round-trip.
    const immediate = await activeObjectState(page)
    await page.waitForTimeout(800)
    const settled = await activeObjectState(page)
    expect(immediate!.angle).toBeGreaterThan(2)
    expectClose(settled!.angle, immediate!.angle, 0.5)
    expectClose(settled!.left, immediate!.left, 0.5)
    expectClose(settled!.top, immediate!.top, 0.5)
  })

  test('corner resize keeps angle and position', async ({ page }) => {
    await addDeviceLayer(page)
    await transformInput(page, 4).fill('20')
    await transformInput(page, 4).press('Enter')
    await page.waitForTimeout(600)
    const before = await activeObjectState(page)

    await dragControl(page, 'br', 30, 30)
    await page.waitForTimeout(800)
    const after = await activeObjectState(page)
    expectClose(after!.angle, before!.angle, 0.5)
    expect(after!.scaleX).toBeGreaterThan(before!.scaleX)
  })

  test('dragging a rotated object keeps its angle', async ({ page }) => {
    await addDeviceLayer(page)
    await dragControl(page, 'mtr', 40, 0)
    await page.waitForTimeout(600)
    const rotated = await activeObjectState(page)

    await dragActiveBody(page, 60, 30)
    await page.waitForTimeout(800)
    const dragged = await activeObjectState(page)
    expectClose(dragged!.angle, rotated!.angle, 0.3)
    expect(dragged!.left).toBeGreaterThan(rotated!.left + 20)
    expect(dragged!.top).toBeGreaterThan(rotated!.top + 5)
  })

  test('undo restores position after drag', async ({ page }) => {
    await addTextLayer(page)
    const before = await activeObjectState(page)
    await dragActiveBody(page, 80, 40)
    await page.waitForTimeout(800)
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(700)
    const layer = await findObject(page, 'text')
    expectClose(layer!.left!, before!.left, 1.5)
    expectClose(layer!.top!, before!.top, 1.5)
  })
})
