import type { Layer, Project, Screen } from '@/types'

export type ProjectChange =
  | { type: 'none' }
  | { type: 'full' }
  | {
      type: 'patch'
      screenId: string
      layerIds: string[]
      layoutLayerIds: string[]
      backgroundChanged: boolean
    }

function screensHaveVisualChanges(current: Project, previous: Project | null): boolean {
  if (!previous || current.screens.length !== previous.screens.length) return true
  if (
    current.layoutLayers !== previous.layoutLayers ||
    current.activeScreenId !== previous.activeScreenId
  )
    return true
  return current.screens.some((screen, index) => {
    const previousScreen = previous.screens[index]
    return (
      screen.id !== previousScreen.id ||
      screen.name !== previousScreen.name ||
      screen.layers !== previousScreen.layers ||
      screen.background !== previousScreen.background
    )
  })
}

function layerOrderKey(layers: Layer[]): string {
  return layers.map((layer) => `${layer.id}:${layer.zIndex}`).join('|')
}

function changedLayerIds(current: Layer[], previous: Layer[]): string[] | null {
  if (current.length !== previous.length) return null
  if (layerOrderKey(current) !== layerOrderKey(previous)) return null
  const ids: string[] = []
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== previous[index]) ids.push(current[index].id)
  }
  return ids
}

/** Chooses the cheapest safe synchronization path from immutable project references. */
export function diffProjectChange(current: Project, previous: Project | null): ProjectChange {
  if (!previous) return { type: 'full' }
  if (current.target !== previous.target) return { type: 'full' }
  if (!screensHaveVisualChanges(current, previous)) return { type: 'none' }
  if (current.screens.length !== previous.screens.length) return { type: 'full' }
  if (current.activeScreenId !== previous.activeScreenId) return { type: 'full' }

  let layoutLayerIds: string[] = []
  if (current.layoutLayers !== previous.layoutLayers) {
    const changed = changedLayerIds(current.layoutLayers, previous.layoutLayers)
    if (!changed) return { type: 'full' }
    layoutLayerIds = changed
  }

  const changedScreens: { screen: Screen; previousScreen: Screen }[] = []
  for (let index = 0; index < current.screens.length; index += 1) {
    const screen = current.screens[index]
    const previousScreen = previous.screens[index]
    if (screen.id !== previousScreen.id) return { type: 'full' }
    if (screen === previousScreen) continue
    if (screen.name !== previousScreen.name) return { type: 'full' }
    if (
      screen.layers !== previousScreen.layers ||
      screen.background !== previousScreen.background
    ) {
      changedScreens.push({ screen, previousScreen })
    }
  }

  if (changedScreens.length > 1) return { type: 'full' }
  if (changedScreens.length === 0) {
    return layoutLayerIds.length > 0
      ? {
          type: 'patch',
          screenId: current.activeScreenId,
          layerIds: [],
          layoutLayerIds,
          backgroundChanged: false,
        }
      : { type: 'none' }
  }

  const { screen, previousScreen } = changedScreens[0]
  const layerIds =
    screen.layers === previousScreen.layers
      ? []
      : changedLayerIds(screen.layers, previousScreen.layers)
  if (!layerIds) return { type: 'full' }
  const backgroundChanged = screen.background !== previousScreen.background

  if (layerIds.length === 0 && layoutLayerIds.length === 0 && !backgroundChanged) {
    return { type: 'none' }
  }
  return { type: 'patch', screenId: screen.id, layerIds, layoutLayerIds, backgroundChanged }
}
