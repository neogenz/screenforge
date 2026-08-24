import { test, expect, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import JSZip from 'jszip'
import {
  addDeviceLayer,
  addTextLayer,
  downloadFirstExportedPng,
  expectNoClippedControl,
  expectNoRawIcon,
  openAndroidProject,
  readDownload,
  waitForApp,
} from './helpers'
import { makeDeviceBezelPng, makeSolidPng, MOCK_BEZEL } from './device-bezel-fixture'
import type { Project } from '../src/types'

async function createTargetProject(page: Page, target: Project['target']): Promise<void> {
  await page.evaluate((nextTarget) => {
    const store = window.__sfStores?.useProjectStore
    if (!store) throw new Error('project store unavailable')
    store.getState().createProject('Export target', nextTarget)
  }, target)
  await expect
    .poll(() => page.evaluate(() => window.__sfStores?.useProjectStore.getState().project?.target))
    .toBe(target)
}

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

  const profileTargets = [
    {
      target: 'app-store-ipad-13' as const,
      folder: 'ipad-13',
      width: 2064,
      height: 2752,
      logicalHeight: 586.667,
    },
    {
      target: 'app-store-watch-series-10' as const,
      folder: 'watch-series-10',
      width: 416,
      height: 496,
      logicalHeight: 524.615,
    },
  ] as const

  for (const target of profileTargets) {
    test(`exports ${target.target} from its real artboard to its exact App Store dimensions`, async ({
      page,
    }) => {
      await waitForApp(page)
      await createTargetProject(page, target.target)

      await expect
        .poll(() =>
          page.evaluate(() => {
            const background = window.__sfCanvas
              ?.getObjects()
              .find(
                (object) =>
                  (object as { data?: { rendererType?: string } }).data?.rendererType ===
                  'background',
              ) as { width?: number; height?: number } | undefined
            return background
              ? {
                  width: Math.round((background.width ?? 0) * 1000) / 1000,
                  height: Math.round((background.height ?? 0) * 1000) / 1000,
                }
              : null
          }),
        )
        .toEqual({ width: 440, height: target.logicalHeight })

      const { names, png } = await downloadFirstExportedPng(page)
      expect(names).toEqual([expect.stringMatching(new RegExp(`^${target.folder}/\\d{2}_`))])
      const decoded = decode(png)
      expect(decoded.width).toBe(target.width)
      expect(decoded.height).toBe(target.height)
      expect(decoded.depth).toBe(8)
      expect(decoded.channels).toBe(3)
    })
  }

  test('ZIP Google Play contient un PNG RGB opaque exact 1080×1920 sous phone/', async ({
    page,
  }) => {
    await waitForApp(page)
    await openAndroidProject(page)
    await page.getByLabel('Ouvrir l’export').click()
    const dialog = page.getByRole('dialog', { name: 'Export officiel' })
    await expect(dialog).toContainText('Google Play · téléphone')
    await expect(dialog).toContainText('1080×1920 px')
    await expect(dialog).toContainText('au moins 2 captures')

    /* Les lignes d'écran empilent une vignette et deux lignes de texte dans un
       bouton coss, dont la variante fixe une hauteur par point d'arrêt. */
    await expectNoClippedControl(page)

    await expectNoRawIcon(page)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      dialog.getByRole('button', { name: 'Exporter le ZIP' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/-google-play\.zip$/)
    const zip = await JSZip.loadAsync(await readDownload(download))
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
    expect(names).toEqual([expect.stringMatching(/^phone\/01_[a-z0-9_]+\.png$/)])
    const png = decode(await zip.files[names[0]].async('uint8array'))
    expect({
      width: png.width,
      height: png.height,
      depth: png.depth,
      channels: png.channels,
    }).toEqual({ width: 1080, height: 1920, depth: 8, channels: 3 })
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
