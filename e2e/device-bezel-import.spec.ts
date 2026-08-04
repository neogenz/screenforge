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
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])]
      .find((item) => item.type === 'device-frame')
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

interface PixelBox {
  x: number
  y: number
  width: number
  height: number
  area: number
}

interface PixelRegion {
  x: number
  y: number
  width: number
  height: number
}

function topDarkComponents(
  image: ReturnType<typeof decode>,
  region: PixelRegion,
): PixelBox[] {
  const pixelCount = region.width * region.height
  const visited = new Uint8Array(pixelCount)
  const queue = new Uint32Array(pixelCount)
  const components: PixelBox[] = []
  let tail = 0
  const isDark = (pixel: number) => {
    const x = region.x + pixel % region.width
    const y = region.y + Math.floor(pixel / region.width)
    const index = (y * image.width + x) * image.channels
    return image.data[index] < 24
      && image.data[index + 1] < 24
      && image.data[index + 2] < 24
      && (image.channels < 4 || image.data[index + 3] > 200)
  }
  const visit = (neighbor: number) => {
    if (visited[neighbor] || !isDark(neighbor)) return
    visited[neighbor] = 1
    queue[tail] = neighbor
    tail += 1
  }

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || !isDark(start)) continue
    let head = 0
    tail = 0
    let minX = region.width
    let minY = region.height
    let maxX = 0
    let maxY = 0
    let area = 0
    visited[start] = 1
    queue[tail] = start
    tail += 1

    while (head < tail) {
      const pixel = queue[head]
      head += 1
      const x = pixel % region.width
      const y = Math.floor(pixel / region.width)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      area += 1

      if (x > 0) visit(pixel - 1)
      if (x + 1 < region.width) visit(pixel + 1)
      if (y > 0) visit(pixel - region.width)
      if (y + 1 < region.height) visit(pixel + region.width)
    }

    const width = maxX - minX + 1
    const height = maxY - minY + 1
    if (
      width >= region.width * 0.2
      && height >= region.height * 0.15
      && area >= pixelCount * 0.02
    ) {
      components.push({
        x: region.x + minX,
        y: region.y + minY,
        width,
        height,
        area,
      })
    }
  }

  return components
}

function expectAlignedBox(actual: PixelBox, expected: PixelBox, tolerance: number) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${key} alignment`).toBeLessThanOrEqual(tolerance)
  }
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

test('rejects invalid and oversized captures without mutating the device', async ({ page }) => {
  const input = page.getByLabel('Importer la capture de l’app')
  await input.setInputFiles({
    name: 'capture.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  })
  await expect(page.getByRole('alert')).toContainText('Format d’image non pris en charge')
  expect(await deviceLayer(page)).not.toHaveProperty('screenshotAssetId')

  await input.setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(16 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText('taille maximale de 16 Mio')
  expect(await deviceLayer(page)).not.toHaveProperty('screenshotAssetId')
})

test('keeps the natural ratio, locks official artwork and persists both assets', async ({ page }) => {
  await uploadBezel(page, makeDeviceBezelPng(), 'Persistent Bezel.png')
  await uploadScreenshot(page)
  await selectDeviceLayer(page)

  await page.getByLabel('Largeur').fill('190')
  await expect.poll(async () => deviceLayer(page)).toMatchObject({ width: 190, height: 310 })
  await expect(page.getByRole('slider', { name: 'Rotation', exact: true })).toBeDisabled()
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
    const state = window.__sfStores?.useProjectStore.getState()
    const project = state?.project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])]
      .find((item) => item.type === 'device-frame')
    if (!state || !layer) throw new Error('device layer missing')
    window.__sfStores?.useCanvasStore.getState().updateLayer(layer.id, {
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

  const screen = beforeReload.importedBezel!.screen
  const screenshotRegion = {
    x: Math.floor(screenshot.width * 0.3),
    y: 0,
    width: Math.ceil(screenshot.width * 0.4),
    height: Math.min(240, screenshot.height),
  }
  const screenshotIslands = topDarkComponents(screenshot, screenshotRegion)
  const bezelIslands = topDarkComponents(bezel, {
    ...screenshotRegion,
    x: screen.x + screenshotRegion.x,
    y: screen.y,
  }).map((box) => ({ ...box, x: box.x - screen.x, y: box.y - screen.y }))
  expect(screenshotIslands).toHaveLength(1)
  expect(bezelIslands).toHaveLength(1)
  expectAlignedBox(bezelIslands[0], screenshotIslands[0], 5)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  const afterReload = await deviceLayer(page)
  expect(afterReload.importedBezel?.assetId).toBeTruthy()
  const { names, png } = await downloadFirstExportedPng(page)
  expect(names).toHaveLength(1)
  expect(names[0]).toMatch(/^6\.9\/\d{2}_[a-z0-9_]+\.png$/)
  const exported = decode(png)
  const exportScaleX = afterReload.width * 3 / afterReload.importedBezel!.naturalWidth
  const exportScaleY = afterReload.height * 3 / afterReload.importedBezel!.naturalHeight
  const outputScreenX = (afterReload.x + afterReload.width * (
    screen.x / afterReload.importedBezel!.naturalWidth
  )) * 3
  const outputScreenY = (afterReload.y + afterReload.height * (
    screen.y / afterReload.importedBezel!.naturalHeight
  )) * 3
  const exportRegion = {
    x: Math.floor(outputScreenX + screenshotRegion.x * exportScaleX),
    y: Math.floor(outputScreenY),
    width: Math.ceil(screenshotRegion.width * exportScaleX),
    height: Math.ceil(screenshotRegion.height * exportScaleY),
  }
  const exportIslands = topDarkComponents(exported, exportRegion).map((box) => ({
    ...box,
    x: (box.x - outputScreenX) / exportScaleX,
    y: (box.y - outputScreenY) / exportScaleY,
    width: box.width / exportScaleX,
    height: box.height / exportScaleY,
  }))
  expect(exportIslands).toHaveLength(1)
  expectAlignedBox(exportIslands[0], screenshotIslands[0], 6)
  expect((await readFile(bezelPath)).byteLength).toBeGreaterThan(0)
  expect((await readFile(screenshotPath)).byteLength).toBeGreaterThan(0)
})
