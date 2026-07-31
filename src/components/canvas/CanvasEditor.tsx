import { useState } from 'react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { buildLayerMenuItems } from '@/components/ui/layer-menu'
import { useCanvas } from '@/hooks/use-canvas'
import { useLayerActions } from '@/hooks/use-layer-actions'
import { useCanvasStore } from '@/stores/canvas.store'

export default function CanvasEditor() {
  const { canvasRef, containerRef, getLayerIdAtPoint } = useCanvas()
  const actions = useLayerActions()
  const layers = useCanvasStore((state) => state.layers)
  const [menu, setMenu] = useState<{ left: number; top: number; layerId: string } | null>(null)

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    const layerId = getLayerIdAtPoint(event.nativeEvent)
    if (!layerId) return
    const { layers: currentLayers, selectedLayerIds, selectLayer } = useCanvasStore.getState()
    if (!currentLayers.some((layer) => layer.id === layerId)) return
    if (!selectedLayerIds.includes(layerId)) selectLayer(layerId)
    setMenu({ left: event.clientX, top: event.clientY, layerId })
  }

  const menuLayer = menu ? layers.find((layer) => layer.id === menu.layerId) : null

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-stage"
      onContextMenu={handleContextMenu}
    >
      <canvas ref={canvasRef} />
      {menu && menuLayer && (
        <ContextMenu
          position={{ left: menu.left, top: menu.top }}
          label={`Actions de ${menuLayer.name}`}
          onClose={() => setMenu(null)}
          items={buildLayerMenuItems(menuLayer, actions)}
        />
      )}
    </div>
  )
}
