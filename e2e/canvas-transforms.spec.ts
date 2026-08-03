import { test, expect } from '@playwright/test'
import {
  activeObjectState,
  activeCenter,
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  dragActiveBody,
  dragControl,
  expectClose,
  findObject,
  layerRows,
  screenCenter,
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

  test('dragging a layer to another screen transfers ownership without reframing', async ({ page }) => {
    await addTextLayer(page)
    const source = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return { screenId: project?.screens[0]?.id, layerId: project?.screens[0]?.layers[0]?.id }
    })
    expect(source.screenId).toBeTruthy()
    expect(source.layerId).toBeTruthy()

    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await page.waitForTimeout(600)
    await layerRows(page).first().click()

    const before = await page.evaluate(() => ({
      history: window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
      viewport: [...(window.__sfCanvas?.viewportTransform ?? [])],
      zoom: window.__sfCanvas?.getZoom() ?? -1,
    }))
    const start = await activeCenter(page)
    const destination = await screenCenter(page, 1)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(destination.x, destination.y, { steps: 12 })

    const preview = await page.evaluate((layerId) => {
      const object = window.__sfCanvas?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === layerId)
      return (object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined)?.data
    }, source.layerId)
    expect(preview?.screenIndex).toBe(1)
    expect(preview?.clipScreenIndex).toBe(1)

    await page.mouse.up()
    await page.waitForTimeout(900)
    const transferred = await page.evaluate((layerId) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const canvas = window.__sfCanvas
      const targetScreen = project?.screens[1]
      const layer = targetScreen?.layers.find((candidate) => candidate.id === layerId)
      const object = canvas?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === layerId)
      const background = canvas?.getObjects()
        .filter((candidate) => (candidate as { data?: { rendererType?: string } }).data?.rendererType === 'background')
        .sort((left, right) => left.left - right.left)[1]
      return {
        sourceCount: project?.screens[0]?.layers.filter((candidate) => candidate.id === layerId).length,
        targetCount: targetScreen?.layers.filter((candidate) => candidate.id === layerId).length,
        activeScreenId: project?.activeScreenId,
        targetScreenId: targetScreen?.id,
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
        storedX: layer?.x,
        renderedX: object && background
          ? object.getBoundingRect().left - background.getBoundingRect().left
          : undefined,
        history: window.__sfStores?.useHistoryStore.getState().past.length,
        viewport: [...(canvas?.viewportTransform ?? [])],
        zoom: canvas?.getZoom(),
      }
    }, source.layerId)
    expect(transferred.sourceCount).toBe(0)
    expect(transferred.targetCount).toBe(1)
    expect(transferred.activeScreenId).toBe(transferred.targetScreenId)
    expect(transferred.selectedIds).toEqual([source.layerId])
    expectClose(transferred.renderedX!, transferred.storedX!, 1)
    expect(transferred.history).toBe(before.history + 1)
    expectClose(transferred.zoom!, before.zoom, 0.0001)
    expect(transferred.viewport).toHaveLength(before.viewport.length)
    transferred.viewport.forEach((value, index) => expectClose(value, before.viewport[index], 0.0001))

    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(800)
    const restored = await page.evaluate((layerId) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        sourceCount: project?.screens[0]?.layers.filter((candidate) => candidate.id === layerId).length,
        targetCount: project?.screens[1]?.layers.filter((candidate) => candidate.id === layerId).length,
      }
    }, source.layerId)
    expect(restored).toEqual({ sourceCount: 1, targetCount: 0 })
  })

  test('dragging a multi-selection transfers every local layer', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    const layerIds = await page.evaluate(() =>
      window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers.map((layer) => layer.id) ?? [])
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await page.waitForTimeout(600)
    await layerRows(page).first().click()
    await layerRows(page).nth(1).click({ modifiers: ['Meta'] })
    expect((await activeObjectState(page))?.isActiveSelection).toBe(true)

    const start = await activeCenter(page)
    const destination = await screenCenter(page, 1)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(destination.x, destination.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(900)

    const result = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        sourceIds: project?.screens[0]?.layers.map((layer) => layer.id) ?? [],
        targetIds: project?.screens[1]?.layers.map((layer) => layer.id) ?? [],
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [],
      }
    })
    expect(result.sourceIds).toEqual([])
    expect(new Set(result.targetIds)).toEqual(new Set(layerIds))
    expect(new Set(result.selectedIds)).toEqual(new Set(layerIds))
  })

  test('dropping in the gutter keeps the source screen and restores clipping', async ({ page }) => {
    await addTextLayer(page)
    const layerId = await page.evaluate(() =>
      window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.id)
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await page.waitForTimeout(600)
    await layerRows(page).first().click()

    const [start, firstScreen, secondScreen] = await Promise.all([
      activeCenter(page),
      screenCenter(page, 0),
      screenCenter(page, 1),
    ])
    const gutter = { x: (firstScreen.x + secondScreen.x) / 2, y: firstScreen.y }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(gutter.x, gutter.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(700)

    const afterGutter = await page.evaluate((id) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const object = window.__sfCanvas?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
      const data = (object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined)?.data
      return {
        sourceCount: project?.screens[0]?.layers.filter((layer) => layer.id === id).length,
        targetCount: project?.screens[1]?.layers.filter((layer) => layer.id === id).length,
        screenIndex: data?.screenIndex,
        clipScreenIndex: data?.clipScreenIndex,
      }
    }, layerId)
    expect(afterGutter).toEqual({
      sourceCount: 1,
      targetCount: 0,
      screenIndex: 0,
      clipScreenIndex: 0,
    })

    const current = await activeCenter(page)
    await page.mouse.move(current.x, current.y)
    await page.mouse.down()
    await page.mouse.move(firstScreen.x, firstScreen.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(700)
    const afterReturn = await page.evaluate((id) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const object = window.__sfCanvas?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
      const data = (object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined)?.data
      return {
        sourceCount: project?.screens[0]?.layers.filter((layer) => layer.id === id).length,
        targetCount: project?.screens[1]?.layers.filter((layer) => layer.id === id).length,
        screenIndex: data?.screenIndex,
        clipScreenIndex: data?.clipScreenIndex,
      }
    }, layerId)
    expect(afterReturn).toEqual({
      sourceCount: 1,
      targetCount: 0,
      screenIndex: 0,
      clipScreenIndex: 0,
    })
  })
})
