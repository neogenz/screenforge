import { test, expect, type Page } from '@playwright/test'
import {
  asBase64,
  APP_STORE_BEZEL,
  corruptPng,
  makeDeviceBezelPng,
  MOCK_BEZEL,
} from './device-bezel-fixture'

interface AnalysisResult {
  ok: boolean
  code?: string
  dataUrl?: string
  metadata?: {
    fileName: string
    naturalWidth: number
    naturalHeight: number
    screen: { x: number; y: number; width: number; height: number }
  }
}

function oversizedDeviceBezelHeader(): Buffer {
  const bytes = Buffer.alloc(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(4_001, 16)
  bytes.writeUInt32BE(4_000, 20)
  return bytes
}

async function analyze(page: Page, bytes: Uint8Array): Promise<AnalysisResult> {
  return page.evaluate(async (base64) => {
    const modulePath = '/src/lib/device-bezel.ts'
    const { analyzeDeviceBezel } = await import(modulePath) as typeof import('../src/lib/device-bezel')
    const binary = atob(base64)
    const payload = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const file = new File([payload], 'iPhone Test - Portrait.png', { type: 'image/png' })
    try {
      const result = await analyzeDeviceBezel(file)
      return { ok: true, ...result }
    } catch (error) {
      return {
        ok: false,
        code: error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'unexpected',
      }
    }
  }, asBase64(bytes))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('detects the enclosed transparent screen with exact geometry', async ({ page }) => {
  const result = await analyze(page, makeDeviceBezelPng())

  expect(result).toMatchObject({
    ok: true,
    metadata: {
      fileName: 'iPhone Test - Portrait.png',
      naturalWidth: MOCK_BEZEL.width,
      naturalHeight: MOCK_BEZEL.height,
      screen: MOCK_BEZEL.screen,
    },
  })
  expect(result.dataUrl).toMatch(/^data:image\/png;base64,/)
  expect(JSON.stringify(result.metadata)).not.toContain('data:image')
})

test('accepts an App Store-sized bezel below the 16 MP ceiling', async ({ page }) => {
  const result = await analyze(page, makeDeviceBezelPng('valid', APP_STORE_BEZEL))
  expect(result).toMatchObject({
    ok: true,
    metadata: {
      naturalWidth: APP_STORE_BEZEL.width,
      naturalHeight: APP_STORE_BEZEL.height,
      screen: APP_STORE_BEZEL.screen,
    },
  })
})

test('does not confuse a real alpha 17 pixel with the flood-fill marker', async ({ page }) => {
  const result = await analyze(page, makeDeviceBezelPng('alpha-17-separator'))

  expect(result).toMatchObject({
    ok: true,
    metadata: {
      screen: { x: 4, y: 8, width: 11, height: 16 },
    },
  })
})

test('rejects opaque, open and corrupt PNGs with stable errors', async ({ page }) => {
  const [opaque, open, corrupt] = await Promise.all([
    analyze(page, makeDeviceBezelPng('opaque')),
    analyze(page, makeDeviceBezelPng('open')),
    analyze(page, corruptPng()),
  ])

  expect(opaque).toEqual({ ok: false, code: 'screen-not-found' })
  expect(open).toEqual({ ok: false, code: 'screen-not-found' })
  expect(corrupt).toEqual({ ok: false, code: 'invalid-image' })
})

test('rejects an oversized file before reading it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/device-bezel.ts'
    const { analyzeDeviceBezel, MAX_DEVICE_BEZEL_FILE_BYTES } = await import(modulePath) as typeof import('../src/lib/device-bezel')
    let read = false
    const file = {
      name: 'huge.png',
      type: 'image/png',
      size: MAX_DEVICE_BEZEL_FILE_BYTES + 1,
      arrayBuffer: () => {
        read = true
        throw new Error('must not read')
      },
    } as unknown as File
    try {
      await analyzeDeviceBezel(file)
      return { code: 'none', read }
    } catch (error) {
      return {
        code: error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'unexpected',
        read,
      }
    }
  })

  expect(result).toEqual({ code: 'file-too-large', read: false })
})

test('rejects oversized IHDR dimensions before decoding pixel data', async ({ page }) => {
  expect(await analyze(page, oversizedDeviceBezelHeader())).toEqual({
    ok: false,
    code: 'image-too-large',
  })
})

test('migrates legacy device layers and rejects malformed bezels', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/project-validation.ts'
    const { isProject, migrateProject } = await import(modulePath) as typeof import('../src/lib/project-validation')
    const layer = {
      id: 'device',
      type: 'device-frame',
      name: 'iPhone',
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: 0,
      deviceModel: 'iphone-17-pro-max',
      deviceColor: 'silver',
      orientation: 'landscape',
      screenshotAssetId: 'screenshot',
    }
    const project = (candidate: object) => {
      const migrated = migrateProject({
        id: 'project',
        name: 'Test',
        activeScreenId: 'screen',
        screens: [{
          id: 'screen',
          name: 'Screen',
          background: { type: 'solid', color: '#fff' },
          layers: [{ ...layer, ...candidate }],
        }],
        globals: {
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: 48,
          fontColor: '#000',
          background: { type: 'solid', color: '#fff' },
          deviceModel: 'iphone-17-pro-max',
          deviceColor: 'silver',
        },
        layoutLayers: [],
        createdAt: 1,
        updatedAt: 1,
      })
      const candidateProject = migrated as {
        screens: Array<{ layers: Array<Record<string, unknown>> }>
      }
      return {
        valid: isProject(migrated),
        layer: candidateProject.screens[0].layers[0],
      }
    }

    const legacy = project({})
    const malformed = project({
      importedBezel: {
        assetId: 'bezel',
        fileName: 'bad.png',
        naturalWidth: 19,
        naturalHeight: 31,
        screen: { x: 18, y: 5, width: 11, height: 19 },
      },
    })
    const valid = project({
      importedBezel: {
        assetId: 'bezel',
        fileName: 'good.png',
        naturalWidth: 19,
        naturalHeight: 31,
        screen: { x: 4, y: 5, width: 11, height: 19 },
      },
    })
    return { legacy, malformed, valid }
  })

  expect(result.legacy.valid).toBe(true)
  expect(result.legacy.layer).not.toHaveProperty('importedBezel')
  expect(result.legacy.layer.orientation).toBe('landscape')
  expect(result.malformed.valid).toBe(false)
  expect(result.malformed.layer).toHaveProperty('importedBezel.assetId', 'bezel')
  expect(result.valid.valid).toBe(true)
  expect(result.valid.layer).toHaveProperty('importedBezel.assetId', 'bezel')
  expect(result.valid.layer.orientation).toBe('portrait')
})
