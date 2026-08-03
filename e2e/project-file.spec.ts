import { expect, test, type Page } from '@playwright/test'
import JSZip from 'jszip'
import { waitForApp } from './helpers'

interface PortableFixture {
  archive: number[]
  assetIds: string[]
  candidate: {
    projectName: string
    screenCount: number
    assets: Array<{ id: string; dataUrl: string }>
  }
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

  expect(await Promise.all([
    readArchive(page, unsupported),
    readArchive(page, await missing.generateAsync({ type: 'uint8array' })),
    readArchive(page, corruptHash),
    readArchive(page, declaredOversize),
  ])).toEqual([
    'unsupported-version',
    'missing-asset',
    'corrupt-asset',
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
