import type { Layer, Project, ProjectSnapshot } from '@/types'

export function collectLayerAssetIds(layer: Layer, ids: Set<string>): void {
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

function collectSceneAssetIds(scene: ProjectSnapshot, ids: Set<string>): void {
  for (const screen of scene.screens) {
    for (const layer of screen.layers) collectLayerAssetIds(layer, ids)
  }
  for (const layer of scene.layoutLayers) collectLayerAssetIds(layer, ids)
}

/**
 * Tout asset binaire que le projet référence — y compris à travers ses releases.
 *
 * Une release fige un instantané et le rejouera pour se vérifier ; l'asset
 * qu'elle nomme doit donc survivre à sa disparition du projet vivant. Sans
 * cette branche, remplacer une capture puis recharger balayait celle que la
 * release d'avant référençait encore, et le lot livré cessait d'être
 * reproductible sans que rien ne le dise.
 */
export function collectAssetIds(project: Project): Set<string> {
  const ids = new Set<string>()
  collectSceneAssetIds(project, ids)
  for (const release of project.releases ?? []) collectSceneAssetIds(release.snapshot, ids)
  return ids
}
