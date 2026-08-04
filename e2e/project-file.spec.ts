import { expect, test, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import JSZip from 'jszip'
import {
  addDeviceLayer,
  downloadFirstExportedPng,
  readDownload,
  waitForApp,
} from './helpers'
import { makeDeviceBezelPng, makeSolidPng, MOCK_BEZEL } from './device-bezel-fixture'

interface PortableFixture {
  archive: number[]
  assetIds: string[]
  candidate: {
    projectName: string
    screenCount: number
    assets: Array<{ id: string; dataUrl: string }>
  }
}

const OVERSIZED_ASSET_BYTES = 64 * 1024 * 1024 + 1

function withCentralUncompressedSize(
  source: Uint8Array,
  entryName: string,
  size: number,
): Uint8Array {
  const bytes = Uint8Array.from(source)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  for (let offset = 0; offset <= bytes.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue
    const nameLength = view.getUint16(offset + 28, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (name !== entryName) continue
    view.setUint32(offset + 24, size, true)
    return bytes
  }
  throw new Error(`ZIP entry not found: ${entryName}`)
}

async function portableFixture(page: Page): Promise<PortableFixture> {
  return page.evaluate(async () => {
    const { clearAssets, registerAsset } = await import('/src/lib/assets.ts')
    const { createProjectFile, readProjectFile } = await import('/src/lib/project-file.ts')
    clearAssets()
    const imageId = registerAsset('data:image/png;base64,aW1hZ2U=')
    const screenshotId = registerAsset('data:image/jpeg;base64,c2NyZWVuc2hvdA==')
    const bezelId = registerAsset('data:image/png;base64,YmV6ZWw=')
    const now = Date.now()
    const base = {
      x: 10,
      y: 20,
      width: 100,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
    }
    const project = {
      id: 'portable-project',
      name: 'Projet portable',
      activeScreenId: 'screen-1',
      screens: [{
        id: 'screen-1',
        name: 'Accueil',
        thumbnail: 'data:image/png;base64,dGh1bWI=',
        background: { type: 'solid' as const, color: '#fff' },
        layers: [
          {
            ...base,
            id: 'image-layer',
            type: 'image' as const,
            name: 'Image',
            zIndex: 0,
            assetId: imageId,
            originalWidth: 100,
            originalHeight: 200,
          },
          {
            ...base,
            id: 'device-layer',
            type: 'device-frame' as const,
            name: 'iPhone',
            zIndex: 1,
            deviceModel: 'iphone-17-pro-max' as const,
            deviceColor: 'silver' as const,
            orientation: 'portrait' as const,
            screenshotAssetId: screenshotId,
            importedBezel: {
              assetId: bezelId,
              fileName: 'bezel.png',
              naturalWidth: 110,
              naturalHeight: 220,
              screen: { x: 5, y: 10, width: 100, height: 200 },
            },
          },
        ],
      }],
      globals: {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 48,
        fontColor: '#111',
        background: { type: 'solid' as const, color: '#fff' },
        deviceModel: 'iphone-17-pro-max' as const,
        deviceColor: 'silver' as const,
      },
      layoutLayers: [{
        ...base,
        id: 'layout-image',
        type: 'image' as const,
        name: 'Logo',
        zIndex: 2,
        scope: 'layout' as const,
        assetId: imageId,
        originalWidth: 100,
        originalHeight: 200,
      }],
      createdAt: now,
      updatedAt: now,
    }
    const blob = await createProjectFile(project)
    const candidate = await readProjectFile(new File([blob], 'portable.screenforge.zip'))
    return {
      archive: Array.from(new Uint8Array(await blob.arrayBuffer())),
      assetIds: [imageId, screenshotId, bezelId],
      candidate: {
        projectName: candidate.project.name,
        screenCount: candidate.project.screens.length,
        assets: candidate.assets,
      },
    }
  })
}

async function readArchive(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (archive) => {
    const { readProjectFile } = await import('/src/lib/project-file.ts')
    try {
      await readProjectFile(new File([Uint8Array.from(archive)], 'test.screenforge.zip'))
      return 'ok'
    } catch (error) {
      return error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'unexpected'
    }
  }, Array.from(bytes))
}

test.beforeEach(async ({ page }) => {
  await waitForApp(page)
})

test('round-trips a versioned archive with each referenced asset once', async ({ page }) => {
  const fixture = await portableFixture(page)
  const zip = await JSZip.loadAsync(Uint8Array.from(fixture.archive))
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort()
  const manifest = JSON.parse(await zip.file('project.json')!.async('string')) as {
    format: string
    version: number
    project: unknown
    assets: Array<{ id: string; path: string; mimeType: string; byteLength: number; sha256: string }>
  }

  expect(names).toEqual(['project.json', ...manifest.assets.map((asset) => asset.path)].sort())
  expect(manifest).toMatchObject({ format: 'screenforge-project', version: 1 })
  expect(manifest.assets).toHaveLength(3)
  expect(new Set(manifest.assets.map((asset) => asset.id))).toEqual(new Set(fixture.assetIds))
  expect(manifest.assets.every((asset) => asset.sha256.match(/^[a-f0-9]{64}$/))).toBe(true)
  expect(JSON.stringify(manifest.project)).not.toContain('data:')
  expect(JSON.stringify(manifest.project)).not.toContain('thumbnail')
  expect(fixture.candidate).toMatchObject({ projectName: 'Projet portable', screenCount: 1 })
  expect(fixture.candidate.assets).toHaveLength(3)
})

test('rejects unsupported, incomplete and corrupt archives with stable errors', async ({ page }) => {
  const fixture = await portableFixture(page)
  const source = Uint8Array.from(fixture.archive)

  async function mutateManifest(mutator: (manifest: Record<string, unknown>) => void) {
    const zip = await JSZip.loadAsync(source)
    const manifest = JSON.parse(await zip.file('project.json')!.async('string')) as Record<string, unknown>
    mutator(manifest)
    zip.file('project.json', JSON.stringify(manifest))
    return zip.generateAsync({ type: 'uint8array' })
  }

  const unsupported = await mutateManifest((manifest) => { manifest.version = 2 })
  const corruptHash = await mutateManifest((manifest) => {
    const assets = manifest.assets as Array<Record<string, unknown>>
    assets[0].sha256 = '0'.repeat(64)
  })
  const declaredOversize = await mutateManifest((manifest) => {
    const assets = manifest.assets as Array<Record<string, unknown>>
    assets[0].byteLength = Number.MAX_SAFE_INTEGER
  })
  const missing = await JSZip.loadAsync(source)
  const missingManifest = JSON.parse(await missing.file('project.json')!.async('string')) as {
    assets: Array<{ path: string }>
  }
  missing.remove(missingManifest.assets[0].path)
  const unknownDirectory = await JSZip.loadAsync(source)
  unknownDirectory.folder('unexpected')
  const nullLayer = await mutateManifest((manifest) => {
    const project = manifest.project as { screens: Array<{ layers: unknown[] }> }
    project.screens[0].layers[0] = null
  })
  const invalidGeometry = await mutateManifest((manifest) => {
    const project = manifest.project as { screens: Array<{ layers: Array<Record<string, unknown>> }> }
    project.screens[0].layers[0].width = 0
  })
  const oversizedCentralEntry = withCentralUncompressedSize(
    source,
    missingManifest.assets[0].path,
    OVERSIZED_ASSET_BYTES,
  )

  expect(await Promise.all([
    readArchive(page, unsupported),
    readArchive(page, await missing.generateAsync({ type: 'uint8array' })),
    readArchive(page, corruptHash),
    readArchive(page, declaredOversize),
    readArchive(page, await unknownDirectory.generateAsync({ type: 'uint8array' })),
    readArchive(page, nullLayer),
    readArchive(page, invalidGeometry),
    readArchive(page, oversizedCentralEntry),
  ])).toEqual([
    'unsupported-version',
    'missing-asset',
    'corrupt-asset',
    'asset-too-large',
    'unsafe-entry',
    'invalid-manifest',
    'invalid-manifest',
    'asset-too-large',
  ])
})

test('rejects an invalid archive without mutating the open project or assets', async ({ page }) => {
  const before = await page.evaluate(async () => {
    const { registerAsset } = await import('/src/lib/assets.ts')
    const { useProjectStore } = await import('/src/stores/project.store.ts')
    return {
      projectId: useProjectStore.getState().project?.id,
      assetId: registerAsset('data:image/png;base64,c2VudGluZWw='),
    }
  })

  expect(await readArchive(page, new TextEncoder().encode('not a zip'))).toBe('invalid-archive')
  expect(await page.evaluate(async ({ projectId, assetId }) => {
    const { resolveAsset } = await import('/src/lib/assets.ts')
    const { useProjectStore } = await import('/src/stores/project.store.ts')
    return {
      projectId: useProjectStore.getState().project?.id,
      asset: resolveAsset(assetId),
      expectedProjectId: projectId,
    }
  }, before)).toEqual({
    projectId: before.projectId,
    expectedProjectId: before.projectId,
    asset: 'data:image/png;base64,c2VudGluZWw=',
  })
})

async function downloadPortableProject(page: Page): Promise<Uint8Array> {
  await page.getByRole('button', { name: 'Ouvrir le menu Projet' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Télécharger une copie' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('backup_demo.screenforge.zip')
  return readDownload(download)
}

test('downloads, imports and reloads a complete portable project', async ({ page }) => {
  await page.getByLabel('Nom du projet').fill('Backup démo')
  await page.getByLabel('Nom du projet').press('Enter')
  await page.getByLabel('Ajouter Texte').click()
  await expect.poll(() => page.evaluate(() => window.__sfStores
    ?.useCanvasStore.getState().layers.some((layer) => layer.type === 'text'))).toBe(true)
  await page.getByLabel('Importer une image').setInputFiles({
    name: 'hero.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(16, 16, [34, 197, 94, 255]),
  })
  await addDeviceLayer(page)
  await page.getByLabel('Importer un bezel Apple').setInputFiles({
    name: 'bezel.png',
    mimeType: 'image/png',
    buffer: makeDeviceBezelPng(),
  })
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: 'capture.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(MOCK_BEZEL.screen.width, MOCK_BEZEL.screen.height, [232, 32, 48, 255]),
  })
  await page.getByLabel('Ajouter un écran').click()
  await expect.poll(() => page.evaluate(() => window.__sfStores
    ?.useProjectStore.getState().project?.screens.length)).toBe(2)
  const before = await page.evaluate(() => ({
    projectId: window.__sfStores?.useProjectStore.getState().project?.id,
    historySize: window.__sfStores?.useHistoryStore.getState().past.length,
  }))
  expect(before.historySize).toBeGreaterThan(0)

  const archive = await downloadPortableProject(page)
  await page.getByLabel('Ouvrir un projet ScreenForge').setInputFiles({
    name: 'backup_demo.screenforge.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(archive),
  })
  await expect(page.getByText('Projet importé.')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible()

  const imported = await page.evaluate(async () => {
    const { resolveAsset } = await import('/src/lib/assets.ts')
    const project = window.__sfStores?.useProjectStore.getState().project
    const layers = project
      ? [...project.layoutLayers, ...project.screens.flatMap((screen) => screen.layers)]
      : []
    const ids = layers.flatMap((layer) => {
      if (layer.type === 'image') return [layer.assetId]
      if (layer.type !== 'device-frame') return []
      return [layer.screenshotAssetId, layer.importedBezel?.assetId].filter(Boolean) as string[]
    })
    return {
      projectId: project?.id,
      screenCount: project?.screens.length,
      historySize: window.__sfStores?.useHistoryStore.getState().past.length,
      assetIds: ids,
      assetsResolved: ids.every((id) => Boolean(resolveAsset(id))),
    }
  })
  expect(imported).toMatchObject({ screenCount: 2, historySize: 0, assetsResolved: true })
  expect(imported.projectId).not.toBe(before.projectId)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  const afterReload = await page.evaluate(async () => {
    const { resolveAsset } = await import('/src/lib/assets.ts')
    const project = window.__sfStores?.useProjectStore.getState().project
    const layers = project
      ? [...project.layoutLayers, ...project.screens.flatMap((screen) => screen.layers)]
      : []
    const device = project?.screens[0].layers.find((layer) => layer.type === 'device-frame')
    if (!device || device.type !== 'device-frame') return null
    const assetIds = layers.flatMap((layer) => {
      if (layer.type === 'image') return [layer.assetId]
      if (layer.type !== 'device-frame') return []
      return [layer.screenshotAssetId, layer.importedBezel?.assetId].filter(Boolean) as string[]
    })
    return {
      projectId: project?.id,
      projectName: project?.name,
      screenCount: project?.screens.length,
      screens: project?.screens.map((screen) => ({
        name: screen.name,
        layerTypes: screen.layers.map((layer) => layer.type).sort(),
      })),
      assetCount: new Set(assetIds).size,
      assetsResolved: assetIds.every((id) => Boolean(resolveAsset(id))),
      device: {
        x: device.x,
        y: device.y,
        width: device.width,
        height: device.height,
      },
    }
  })
  expect(afterReload).toMatchObject({
    projectId: imported.projectId,
    projectName: 'Backup démo',
    screenCount: 2,
    screens: [
      { name: 'Écran 1', layerTypes: ['device-frame', 'image', 'text'] },
      { name: 'Écran 2', layerTypes: [] },
    ],
    assetCount: 3,
    assetsResolved: true,
  })

  const { png } = await downloadFirstExportedPng(page)
  const decoded = decode(png)
  expect(decoded).toMatchObject({ width: 1320, height: 2868, depth: 8, channels: 3 })
  expect(afterReload).not.toBeNull()
  if (!afterReload) throw new Error('Imported project missing after reload')
  const state = afterReload.device
  const x = Math.floor((state.x + state.width * (9.5 / MOCK_BEZEL.width)) * 3)
  const y = Math.floor((state.y + state.height * (14.5 / MOCK_BEZEL.height)) * 3)
  const offset = (y * decoded.width + x) * decoded.channels
  expect(Array.from(decoded.data.slice(offset, offset + 3))).toEqual([232, 32, 48])
})

test('keeps the current session intact when UI import rejects a corrupt file', async ({ page }) => {
  const before = await page.evaluate(async () => {
    const { registerAsset } = await import('/src/lib/assets.ts')
    return {
      projectId: window.__sfStores?.useProjectStore.getState().project?.id,
      activeScreenId: window.__sfStores?.useCanvasStore.getState().activeScreenId,
      assetId: registerAsset('data:image/png;base64,c3RheQ=='),
    }
  })
  await page.getByLabel('Ouvrir un projet ScreenForge').setInputFiles({
    name: 'broken.screenforge.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('broken'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'Archive projet invalide.' })).toBeVisible()
  expect(await page.evaluate(async ({ assetId }) => {
    const { resolveAsset } = await import('/src/lib/assets.ts')
    return {
      projectId: window.__sfStores?.useProjectStore.getState().project?.id,
      activeScreenId: window.__sfStores?.useCanvasStore.getState().activeScreenId,
      asset: resolveAsset(assetId),
    }
  }, before)).toEqual({
    projectId: before.projectId,
    activeScreenId: before.activeScreenId,
    asset: 'data:image/png;base64,c3RheQ==',
  })
})

test('project menu is keyboard navigable and restores focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Ouvrir le menu Projet' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'Fichier du projet' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu', { name: 'Fichier du projet' })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
