import type { Layer, Screen } from '@/types'

export interface LocalLayerTransfer {
  layer: Layer
  sourceScreenId: string
  targetScreenId: string
  update: Partial<Layer>
}

export interface LayoutLayerUpdate {
  layerId: string
  update: Partial<Layer>
}

interface ApplyLayerTransferInput {
  screens: Screen[]
  layoutLayers: Layer[]
  localTransfers: readonly LocalLayerTransfer[]
  layoutUpdates: readonly LayoutLayerUpdate[]
}

interface LayerTransferResult {
  screens: Screen[]
  layoutLayers: Layer[]
  destinationScreenId?: string
}

export function applyLayerTransfer({
  screens,
  layoutLayers,
  localTransfers,
  layoutUpdates,
}: ApplyLayerTransferInput): LayerTransferResult {
  const transfer = localTransfers.find((change) => change.sourceScreenId !== change.targetScreenId)
  const changesBySource = new Map<string, Map<string, LocalLayerTransfer>>()
  const additionsByTarget = new Map<string, LocalLayerTransfer[]>()

  for (const change of localTransfers) {
    const sourceChanges = changesBySource.get(change.sourceScreenId) ?? new Map()
    sourceChanges.set(change.layer.id, change)
    changesBySource.set(change.sourceScreenId, sourceChanges)
    if (change.sourceScreenId !== change.targetScreenId) {
      const additions = additionsByTarget.get(change.targetScreenId) ?? []
      additions.push(change)
      additionsByTarget.set(change.targetScreenId, additions)
    }
  }

  const nextScreens = screens.map((screen) => {
    const sourceChanges = changesBySource.get(screen.id)
    const layers = sourceChanges
      ? screen.layers.flatMap((layer) => {
          const change = sourceChanges.get(layer.id)
          if (!change) return [layer]
          return change.targetScreenId === screen.id
            ? [{ ...layer, ...change.update } as Layer]
            : []
        })
      : screen.layers
    const additions = additionsByTarget.get(screen.id)
    if (!additions?.length) {
      return layers === screen.layers ? screen : { ...screen, layers }
    }
    const topZIndex = Math.max(
      -1,
      ...layers.map((layer) => layer.zIndex),
      ...layoutLayers.map((layer) => layer.zIndex),
    )
    const moved = [...additions]
      .sort((left, right) => left.layer.zIndex - right.layer.zIndex)
      .map(
        (change, index) =>
          ({
            ...change.layer,
            ...change.update,
            zIndex: topZIndex + index + 1,
          }) as Layer,
      )
    return { ...screen, layers: [...layers, ...moved] }
  })
  const updatesById = new Map(layoutUpdates.map((change) => [change.layerId, change.update]))

  return {
    screens: nextScreens,
    layoutLayers:
      layoutUpdates.length > 0
        ? layoutLayers.map((layer) => {
            const update = updatesById.get(layer.id)
            return update ? ({ ...layer, ...update, scope: 'layout' } as Layer) : layer
          })
        : layoutLayers,
    destinationScreenId: transfer?.targetScreenId,
  }
}
