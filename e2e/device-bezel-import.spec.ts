import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import {
  addDeviceLayer,
  controlPosition,
  downloadFirstExportedPng,
  findObject,
  waitForApp,
} from './helpers'
import {
  makeDeviceBezelPng,
  makeSolidPng,
  MOCK_BEZEL,
} from './device-bezel-fixture'

interface DeviceLayerState {
  width: number
  height: number
  rotation: number
  opacity: number
  screenshotAssetId?: string
  importedBezel?: {
    assetId: string
    fileName: string
    naturalWidth: number
    naturalHeight: number
    screen: { x: number; y: number; width: number; height: number }
  }
  x: number
  y: number
}

async function deviceLayer(page: Page): Promise<DeviceLayerState> {
  return page.evaluate(() => {
    const stores = (window as unknown as {
      __sfStores?: { useCanvasStore: { getState: () => { layers: Array<{ type: string }> } } }
    }).__sfStores
    const layer = stores?.useCanvasStore.getState().layers.find((item) => item.type === 'device-frame')
    if (!layer) throw new Error('device layer missing')
    return JSON.parse(JSON.stringify(layer)) as DeviceLayerState
  })
}

async function uploadBezel(page: Page, buffer: Buffer, name = 'Apple Bezel.png') {
  await page.getByLabel('Importer un bezel Apple').setInputFiles({
    name,
    mimeType: 'image/png',
    buffer,
  })
}

async function uploadScreenshot(page: Page) {
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: 'capture.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(MOCK_BEZEL.screen.width, MOCK_BEZEL.screen.height, [232, 32, 48, 255]),
  })
}

async function selectDeviceLayer(page: Page) {
  await page.getByRole('option', { name: /iPhone, device-frame/ }).click()
}

function darkRuns(
  image: { width: number; channels: number; data: Uint8Array | Uint16Array },
  x: number,
  yAt: (offset: number) => number,
  length: number,
): Array<[number, number]> {
  const runs: Array<[number, number]> = []
  let start = -1
  for (let offset = 0; offset < length; offset += 1) {
    const y = yAt(offset)
    const index = (y * image.width + x) * image.channels
    const dark = image.data[index] < 24
      && image.data[index + 1] < 24
      && image.data[index + 2] < 24
      && (image.channels < 4 || image.data[index + 3] > 200)
    if (dark && start < 0) start = offset
    if (!dark && start >= 0) {
      runs.push([start, offset - 1])
      start = -1
    }
  }
  if (start >= 0) runs.push([start, length - 1])
  return runs.filter(([from, to]) => to - from > 20)
}

test.beforeEach(async ({ page }) => {
  await waitForApp(page)
  await addDeviceLayer(page)
})

test('imports, protects, deduplicates and removes an Apple bezel', async ({ page }) => {
  const valid = makeDeviceBezelPng()
  await uploadBezel(page, valid, 'iPhone Test Blue.png')
  await expect(page.getByText('iPhone Test Blue.png')).toBeVisible()
  await expect(page.getByLabel('Modèle d’appareil')).toHaveCount(0)

  const first = await deviceLayer(page)
  expect(first.importedBezel).toMatchObject({
    fileName: 'iPhone Test Blue.png',
    naturalWidth: MOCK_BEZEL.width,
    naturalHeight: MOCK_BEZEL.height,
  })

  await uploadBezel(page, makeDeviceBezelPng('opaque'), 'opaque.png')
  await expect(page.getByRole('alert')).toContainText('introuvable')
  expect((await deviceLayer(page)).importedBezel?.assetId).toBe(first.importedBezel?.assetId)

  await uploadBezel(page, valid, 'same-payload.png')
  expect((await deviceLayer(page)).importedBezel?.assetId).toBe(first.importedBezel?.assetId)

  await page.getByRole('button', { name: 'Retirer le bezel Apple' }).click()
  await expect(page.getByLabel('Modèle d’appareil')).toBeVisible()
  expect(await deviceLayer(page)).not.toHaveProperty('importedBezel')
})

test('keeps the natural ratio, locks official artwork and persists both assets', async ({ page }) => {
  await uploadBezel(page, makeDeviceBezelPng(), 'Persistent Bezel.png')
  await uploadScreenshot(page)
  await selectDeviceLayer(page)

  await page.getByLabel('Largeur').fill('190')
  await expect.poll(async () => deviceLayer(page)).toMatchObject({ width: 190, height: 310 })
  await expect(page.getByLabel('Rotation')).toBeDisabled()
  await expect(page.getByLabel('Opacité')).toBeDisabled()
  await expect(page.getByLabel('Activer l’ombre de l’appareil')).toHaveCount(0)
  expect(await page.evaluate(() => window.__sfCanvas
    ?.getActiveObject()?.isControlVisible('mtr'))).toBe(false)

  const corner = await controlPosition(page, 'br')
  expect(corner).not.toBeNull()
  await page.keyboard.down('Shift')
  await page.mouse.move(corner!.x, corner!.y)
  await page.mouse.down()
  await page.mouse.move(corner!.x + 40, corner!.y + 20, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  const resized = await deviceLayer(page)
  expect(resized.width / resized.height).toBeCloseTo(MOCK_BEZEL.width / MOCK_BEZEL.height, 3)

  await expect(page.getByRole('status')).toContainText('Enregistré', { timeout: 10_000 })
  const beforeReload = await deviceLayer(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  await selectDeviceLayer(page)
  await expect(page.getByText('Persistent Bezel.png')).toBeVisible()
  const afterReload = await deviceLayer(page)
  expect(afterReload.importedBezel?.assetId).toBe(beforeReload.importedBezel?.assetId)
  expect(afterReload.screenshotAssetId).toBe(beforeReload.screenshotAssetId)
  const object = await findObject(page, 'device-frame')
  expect(object?.data?.resourceKey).toContain(afterReload.importedBezel?.assetId)
  expect(object?.data?.resourceKey).toContain(afterReload.screenshotAssetId)
})

test('falls back to the generated frame when an imported asset is missing', async ({ page }) => {
  await page.evaluate(() => {
    const stores = (window as unknown as {
      __sfStores?: {
        useCanvasStore: {
          getState: () => {
            layers: Array<{ id: string; type: string }>
            updateLayer: (id: string, updates: object) => void
          }
        }
      }
    }).__sfStores
    const state = stores?.useCanvasStore.getState()
    const layer = state?.layers.find((item) => item.type === 'device-frame')
    if (!state || !layer) throw new Error('device layer missing')
    state.updateLayer(layer.id, {
      importedBezel: {
        assetId: 'missing',
        fileName: 'Missing.png',
        naturalWidth: 19,
        naturalHeight: 31,
        screen: { x: 4, y: 5, width: 11, height: 19 },
      },
    })
  })

  await expect.poll(async () => (await findObject(page, 'device-frame'))?.data?.resourceKey)
    .toContain('generated')
  await expect(page.getByText('Missing.png')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retirer le bezel Apple' })).toBeVisible()
})

test('serializes bezel analysis and disables every import trigger while busy', async ({ page }) => {
  await page.evaluate(() => {
    const state = window as unknown as {
      __bezelReadControl?: { reads: number; release?: () => void }
    }
    const nativeRead = FileReader.prototype.readAsArrayBuffer
    state.__bezelReadControl = { reads: 0 }
    FileReader.prototype.readAsArrayBuffer = function (blob) {
      const control = state.__bezelReadControl!
      control.reads += 1
      control.release = () => nativeRead.call(this, blob)
    }
  })

  await uploadBezel(page, makeDeviceBezelPng(), 'first.png')
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    __bezelReadControl?: { reads: number }
  }).__bezelReadControl?.reads)).toBe(1)
  const source = page.getByRole('group', { name: 'Source du cadre' })
  await expect(source.getByRole('button', { name: 'ScreenForge' })).toBeDisabled()
  await expect(source.getByRole('button', { name: 'Apple officiel' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Importer le PNG Apple' })).toBeDisabled()

  await uploadBezel(page, makeDeviceBezelPng(), 'second.png')
  expect(await page.evaluate(() => (window as unknown as {
    __bezelReadControl?: { reads: number }
  }).__bezelReadControl?.reads)).toBe(1)
  expect(await deviceLayer(page)).not.toHaveProperty('importedBezel')

  await page.evaluate(() => (window as unknown as {
    __bezelReadControl?: { release?: () => void }
  }).__bezelReadControl?.release?.())
  await expect(page.getByText('first.png')).toBeVisible()
  await expect(page.getByText('second.png')).toHaveCount(0)
})

test('accepts a real Apple Product Bezel outside the repository', async ({ page }) => {
  const bezelPath = process.env.APPLE_BEZEL_PATH
  const screenshotPath = process.env.APPLE_SCREENSHOT_PATH
  test.skip(
    !bezelPath || !screenshotPath,
    'Set APPLE_BEZEL_PATH and APPLE_SCREENSHOT_PATH to matching iPhone assets',
  )
  if (!bezelPath || !screenshotPath) return

  await page.getByLabel('Importer un bezel Apple').setInputFiles(bezelPath)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('Importer la capture de l’app').setInputFiles(screenshotPath)
  await expect(page.getByRole('status')).toContainText('Enregistré', { timeout: 10_000 })
  const screenshot = decode(await readFile(screenshotPath))
  const bezel = decode(await readFile(bezelPath))
  const beforeReload = await deviceLayer(page)
  expect(beforeReload.importedBezel?.screen).toMatchObject({
    width: screenshot.width,
    height: screenshot.height,
  })

  const scanLength = Math.min(240, screenshot.height)
  const screenshotRuns = darkRuns(
    screenshot,
    Math.floor(screenshot.width / 2),
    (offset) => offset,
    scanLength,
  )
  const screen = beforeReload.importedBezel!.screen
  const bezelRuns = darkRuns(
    bezel,
    screen.x + Math.floor(screen.width / 2),
    (offset) => screen.y + offset,
    scanLength,
  )
  expect(screenshotRuns).toHaveLength(1)
  expect(bezelRuns).toHaveLength(1)
  expect(bezelRuns[0][0]).toBeCloseTo(screenshotRuns[0][0], -1)
  expect(bezelRuns[0][1]).toBeCloseTo(screenshotRuns[0][1], -1)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  const afterReload = await deviceLayer(page)
  expect(afterReload.importedBezel?.assetId).toBeTruthy()
  const { names, png } = await downloadFirstExportedPng(page)
  expect(names).toHaveLength(1)
  expect(names[0]).toMatch(/^6\.9\/\d{2}_[a-z0-9_]+\.png$/)
  const exported = decode(png)
  const outputX = Math.floor((afterReload.x + afterReload.width * (
    (screen.x + screen.width / 2) / afterReload.importedBezel!.naturalWidth
  )) * 3)
  const exportRuns = darkRuns(
    exported,
    outputX,
    (offset) => Math.floor((afterReload.y + afterReload.height * (
      (screen.y + offset) / afterReload.importedBezel!.naturalHeight
    )) * 3),
    scanLength,
  )
  expect(exportRuns).toHaveLength(1)
  expect(exportRuns[0][0]).toBeCloseTo(screenshotRuns[0][0], -1)
  expect(exportRuns[0][1]).toBeCloseTo(screenshotRuns[0][1], -1)
  expect((await readFile(bezelPath)).byteLength).toBeGreaterThan(0)
  expect((await readFile(screenshotPath)).byteLength).toBeGreaterThan(0)
})
