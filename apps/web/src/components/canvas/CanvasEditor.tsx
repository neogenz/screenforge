import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { SelectionToolbar } from '@/components/canvas/SelectionToolbar'
import { ContextMenu } from '@/components/patterns/action-menu'
import { ConfirmAction } from '@/components/patterns/confirm-action'
import { buildLayerMenuItems } from '@/components/layers-panel/layer-menu'
import { useCanvas } from '@/hooks/use-canvas'
import { useLayerActions } from '@/hooks/use-layer-actions'
import { layerDisplayName } from '@/lib/layer-factories'
import { SCREENSHOT_IMAGE_TYPES } from '@/lib/image'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'

export default function CanvasEditor() {
  const { canvasRef, containerRef, getLayerIdAtPoint, selectionFrame } = useCanvas()
  const actions = useLayerActions()
  const layers = useProjectStore(useShallow((state) => getProjectLayers(state.project)))
  const [menu, setMenu] = useState<{ left: number; top: number; layerId: string } | null>(null)
  const [dropping, setDropping] = useState(false)
  // Les ids sont capturés à la demande, pas relus depuis la sélection en
  // direct : le menu se ferme avant que la confirmation ne soit tranchée, et
  // un clic peut retomber sur la ligne qu'il vient de quitter entre-temps.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    const layerId = getLayerIdAtPoint(event.nativeEvent)
    if (!layerId) return
    const { selectedLayerIds, selectLayer } = useCanvasStore.getState()
    const currentLayers = getProjectLayers(useProjectStore.getState().project)
    if (!currentLayers.some((layer) => layer.id === layerId)) return
    if (!selectedLayerIds.includes(layerId)) selectLayer(layerId)
    setMenu({ left: event.clientX, top: event.clientY, layerId })
  }

  const menuLayer = menu ? layers.find((layer) => layer.id === menu.layerId) : null

  /**
   * Le geste Finder → fenêtre fait quelque chose, ou le navigateur ouvre le PNG.
   *
   * Rien n'est écrit au projet ici : la règle « rien n'est écrit pendant qu'un
   * geste court » vaut pour celui-ci comme pour un glisser de calque. Le dépôt
   * remplit l'entrée de « Générer les visuels » et c'est la boîte qui décide,
   * après relecture. Un fichier qui n'est pas une capture est ignoré sans un
   * mot : le dépôt d'un `.txt` sur une planche n'est pas une erreur à signaler,
   * c'est un geste qui ne vise pas cette cible.
   */
  function droppedCaptures(transfer: DataTransfer): File[] {
    return [...transfer.files].filter((file) =>
      (SCREENSHOT_IMAGE_TYPES as readonly string[]).includes(file.type),
    )
  }

  function handleDragOver(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!dropping) setDropping(true)
  }

  function handleDrop(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDropping(false)
    const captures = droppedCaptures(event.dataTransfer)
    if (captures.length > 0) useUIStore.getState().openCampaignWithCaptures(captures)
  }

  return (
    <div
      ref={containerRef}
      // Le grain est porté par la scène et non par le canevas : Fabric peint
      // par-dessus, donc un motif posé plus bas dans l'arbre serait recouvert.
      className={cn(
        'stage-grain relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-stage',
        // « Vous êtes ici » : c'est exactement ce que le marqueur nomme.
        dropping && 'ring-1 ring-inset ring-marker',
      )}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />
      <SelectionToolbar frame={selectionFrame} />
      {menu && menuLayer && (
        <ContextMenu
          position={{ left: menu.left, top: menu.top }}
          label={`Actions de ${layerDisplayName(menuLayer)}`}
          onClose={() => setMenu(null)}
          items={buildLayerMenuItems(menuLayer, actions, { onRequestDelete: setPendingDeleteIds })}
        />
      )}

      {pendingDeleteIds && (
        <ConfirmAction
          open
          onOpenChange={(open) => {
            if (!open) setPendingDeleteIds(null)
          }}
          title={`Supprimer ${pendingDeleteIds.length} calques ?`}
          confirmLabel={`Supprimer ${pendingDeleteIds.length} calques`}
          onConfirm={() => actions.removeIds(pendingDeleteIds)}
        />
      )}
    </div>
  )
}
