import { useCanvasStore } from '@/stores/canvas.store'
import type { Layer } from '@/types'

function sameScope(layer: Layer, candidate: Layer): boolean {
  return (candidate.scope === 'layout') === (layer.scope === 'layout')
}

/** Layers of the same scope, ordered by ascending zIndex (bottom → top). */
function scopedGroup(layers: Layer[], layer: Layer): Layer[] {
  return layers
    .filter((candidate) => sameScope(layer, candidate))
    .sort((first, second) => first.zIndex - second.zIndex)
}

/**
 * Layer actions shared by the layers panel and the canvas context menu.
 * When the acted-on layer belongs to a multi-selection, the action applies
 * to the whole selection (one history entry), matching canvas editor norms.
 */
export function useLayerActions() {
  const {
    layers,
    selectedLayerIds,
    setLayers,
    selectLayers,
    clearSelection,
    updateLayer,
    reorderLayer,
  } = useCanvasStore()

  function targetIds(layer: Layer): string[] {
    return selectedLayerIds.includes(layer.id) && selectedLayerIds.length > 1
      ? selectedLayerIds
      : [layer.id]
  }

  function remove(layer: Layer) {
    const ids = targetIds(layer)
    setLayers(layers.filter((candidate) => !ids.includes(candidate.id)))
    clearSelection()
  }

  function duplicate(layer: Layer) {
    const ids = targetIds(layer)
    let screenZ = layers.filter((candidate) => candidate.scope !== 'layout').length
    let layoutZ = layers.length - screenZ
    const newIds: string[] = []
    const duplicates = layers
      .filter((candidate) => ids.includes(candidate.id))
      .map((candidate) => {
        const copy: Layer = {
          ...candidate,
          id: crypto.randomUUID(),
          name: `${candidate.name} copie`,
          x: candidate.x + 16,
          y: candidate.y + 16,
          zIndex: candidate.scope === 'layout' ? layoutZ++ : screenZ++,
        }
        newIds.push(copy.id)
        return copy
      })
    setLayers([...layers, ...duplicates])
    selectLayers(newIds)
  }

  function setVisibility(layer: Layer, visible: boolean) {
    const ids = targetIds(layer)
    if (ids.length === 1) {
      updateLayer(ids[0], { visible })
    } else {
      setLayers(layers.map((candidate) =>
        ids.includes(candidate.id) ? { ...candidate, visible } : candidate))
    }
  }

  function setLocked(layer: Layer, locked: boolean) {
    const ids = targetIds(layer)
    if (ids.length === 1) {
      updateLayer(ids[0], { locked })
    } else {
      setLayers(layers.map((candidate) =>
        ids.includes(candidate.id) ? { ...candidate, locked } : candidate))
    }
  }

  function groupIndex(layer: Layer): number {
    return scopedGroup(layers, layer).findIndex((candidate) => candidate.id === layer.id)
  }

  function canMoveForward(layer: Layer): boolean {
    const index = groupIndex(layer)
    return index !== -1 && index < scopedGroup(layers, layer).length - 1
  }

  function canMoveBackward(layer: Layer): boolean {
    return groupIndex(layer) > 0
  }

  function moveForward(layer: Layer) {
    const index = groupIndex(layer)
    if (index !== -1) reorderLayer(layer.id, index + 1)
  }

  function moveBackward(layer: Layer) {
    const index = groupIndex(layer)
    if (index > 0) reorderLayer(layer.id, index - 1)
  }

  function rename(layer: Layer, name: string) {
    updateLayer(layer.id, { name })
  }

  return {
    remove,
    duplicate,
    setVisibility,
    setLocked,
    canMoveForward,
    canMoveBackward,
    moveForward,
    moveBackward,
    rename,
  }
}

export type LayerActions = ReturnType<typeof useLayerActions>
