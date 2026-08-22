import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAssets,
  readDirtyAssets,
  registerAsset,
  resolveAsset,
  sweepAssets,
} from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import type { Layer, Project } from '@/types'

function baseLayer(id: string) {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
  }
}

function project(layers: Layer[], layoutLayers: Layer[] = []): Project {
  return {
    id: 'project',
    name: 'Project',
    profileId: 'iphone-6.9',
    activeScreenId: 'screen',
    screens: [
      {
        id: 'screen',
        name: 'Screen',
        background: { type: 'solid', color: '#fff' },
        layers,
      },
    ],
    layoutLayers,
    globals: {
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 40,
      fontColor: '#000',
      background: { type: 'solid', color: '#fff' },
      deviceModel: 'iphone-17-pro-max',
      deviceColor: 'silver',
    },
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('asset references', () => {
  beforeEach(clearAssets)

  it('collects image, screenshot and imported bezel ids across scopes', () => {
    const image = {
      ...baseLayer('image'),
      type: 'image' as const,
      assetId: 'image-asset',
      originalWidth: 1,
      originalHeight: 1,
    }
    const device = {
      ...baseLayer('device'),
      type: 'device-frame' as const,
      deviceModel: 'iphone-17-pro-max' as const,
      deviceColor: 'silver' as const,
      orientation: 'portrait' as const,
      screenshotAssetId: 'screenshot-asset',
      importedBezel: {
        assetId: 'bezel-asset',
        fileName: 'bezel.png',
        naturalWidth: 10,
        naturalHeight: 20,
        screen: { x: 1, y: 2, width: 8, height: 16 },
      },
      scope: 'layout' as const,
    }

    expect([...collectAssetIds(project([image], [device]))].sort()).toEqual([
      'bezel-asset',
      'image-asset',
      'screenshot-asset',
    ])
  })

  it('keeps shared references and removes every orphan index', () => {
    const kept = registerAsset('data:image/png;base64,a2VwdA==')
    const removed = registerAsset('data:image/png;base64,b3JwaGFu')
    const duplicateReference = {
      ...baseLayer('image'),
      type: 'image' as const,
      assetId: kept,
      originalWidth: 1,
      originalHeight: 1,
    }
    const keepIds = collectAssetIds(
      project([duplicateReference, { ...duplicateReference, id: 'image-2' }]),
    )

    expect(sweepAssets(keepIds)).toEqual([removed])
    expect(resolveAsset(kept)).toBeDefined()
    expect(resolveAsset(removed)).toBeUndefined()
    expect(readDirtyAssets().map((asset) => asset.id)).toEqual([kept])
    expect(registerAsset('data:image/png;base64,b3JwaGFu')).not.toBe(removed)
  })
})
