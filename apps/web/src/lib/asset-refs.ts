import type { Layer, Project } from '@/types'

function collectLayerAssetIds(layer: Layer, ids: Set<string>): void {
  switch (layer.type) {
    case 'image':
      ids.add(layer.assetId)
      return
    case 'device-frame':
      if (layer.screenshotAssetId) ids.add(layer.screenshotAssetId)
      if (layer.importedBezel) ids.add(layer.importedBezel.assetId)
      return
    case 'shape':
    case 'icon':
    case 'text':
      return
    default:
      layer satisfies never
  }
}

/** Returns every binary asset referenced by screen and shared layers. */
export function collectAssetIds(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const screen of project.screens) {
    for (const layer of screen.layers) collectLayerAssetIds(layer, ids)
  }
  for (const layer of project.layoutLayers) collectLayerAssetIds(layer, ids)
  return ids
}
