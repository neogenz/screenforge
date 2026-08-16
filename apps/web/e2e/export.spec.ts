import { test, expect } from '@playwright/test'
import { decode } from 'fast-png'
import { addDeviceLayer, addTextLayer, downloadFirstExportedPng, waitForApp } from './helpers'
import { makeDeviceBezelPng, makeSolidPng, MOCK_BEZEL } from './device-bezel-fixture'

/**
 * Critical path: exported PNGs must be pixel-exact for App Store Connect.
 */
test.describe('export', () => {
  test('ZIP contains a pixel-exact 1320×2868 opaque RGB PNG', async ({ page }) => {
    await waitForApp(page)
    await addDeviceLayer(page)
    await addTextLayer(page)

    const { names, png } = await downloadFirstExportedPng(page)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/^6\.9\/\d{2}_[a-z0-9_]+\.png$/)
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    expect(view.getUint32(16)).toBe(1320) // IHDR width
    expect(view.getUint32(20)).toBe(2868) // IHDR height
    expect(view.getUint8(24)).toBe(8) // bit depth
    expect(view.getUint8(25)).toBe(2) // color type RGB (opaque)
  })

  test('official bezel export preserves screenshot, frame and transparent exterior', async ({
    page,
  }) => {
    await waitForApp(page)
    await addDeviceLayer(page)
    await page.getByLabel('Importer un bezel Apple').setInputFiles({
      name: 'Mock Apple Bezel.png',
      mimeType: 'image/png',
      buffer: makeDeviceBezelPng(),
    })
    await page.getByLabel('Importer la capture de l’app').setInputFiles({
      name: 'capture.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(MOCK_BEZEL.screen.width, MOCK_BEZEL.screen.height, [232, 32, 48, 255]),
    })

    const state = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
      return [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
        (layer) => layer.type === 'device-frame',
      ) as {
        x: number
        y: number
        width: number
        height: number
      }
    })
    const { names, png } = await downloadFirstExportedPng(page)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/^6\.9\/\d{2}_[a-z0-9_]+\.png$/)
    const decoded = decode(png)
    expect(decoded.width).toBe(1320)
    expect(decoded.height).toBe(2868)
    expect(decoded.depth).toBe(8)
    expect(decoded.channels).toBe(3)

    const pixel = (boardX: number, boardY: number) => {
      const x = Math.floor(boardX * 3)
      const y = Math.floor(boardY * 3)
      const offset = (y * decoded.width + x) * decoded.channels
      return Array.from(decoded.data.slice(offset, offset + 3))
    }
    const naturalPoint = (x: number, y: number) =>
      pixel(
        state.x + state.width * (x / MOCK_BEZEL.width),
        state.y + state.height * (y / MOCK_BEZEL.height),
      )

    expect(naturalPoint(9.5, 14.5)).toEqual([232, 32, 48])
    expect(naturalPoint(3, 15)).toEqual([24, 88, 176])
    expect(naturalPoint(0.5, 0.5)).toEqual(pixel(10, 10))
  })
})
