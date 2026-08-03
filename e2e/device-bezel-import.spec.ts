import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import JSZip from 'jszip'
import {
  addDeviceLayer,
  controlPosition,
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
  }
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

async function exportFirstPng(page: Page): Promise<Uint8Array> {
  await page.getByLabel('Ouvrir l’export').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
  ])
  expect(await download.failure()).toBeNull()
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const zip = await JSZip.loadAsync(Buffer.concat(chunks))
  const entry = Object.values(zip.files).find((file) => !file.dir)
  if (!entry) throw new Error('exported PNG missing')
  return entry.async('uint8array')
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

test('accepts a real Apple Product Bezel outside the repository', async ({ page }) => {
  const bezelPath = process.env.APPLE_BEZEL_PATH
  test.skip(!bezelPath, 'Set APPLE_BEZEL_PATH to an extracted Apple Product Bezel PNG')
  if (!bezelPath) return

  await page.getByLabel('Importer un bezel Apple').setInputFiles(bezelPath)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await uploadScreenshot(page)
  await expect(page.getByRole('status')).toContainText('Enregistré', { timeout: 10_000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  expect((await deviceLayer(page)).importedBezel?.assetId).toBeTruthy()
  expect((await exportFirstPng(page)).byteLength).toBeGreaterThan(0)
  expect((await readFile(bezelPath)).byteLength).toBeGreaterThan(0)
})
