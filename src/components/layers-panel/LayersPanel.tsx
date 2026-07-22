import { useRef } from 'react'
import { Type, Square, ImageIcon, Smartphone } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '@/stores/canvas.store'
import { LayerItem } from './LayerItem'
import { cn } from '@/lib/utils'
import type { Layer, TextLayer, ShapeLayer } from '@/types'

const addBtnCls = cn(
  'flex h-8 w-8 items-center justify-center rounded-md text-muted',
  'transition-colors duration-100 ease-out',
  'hover:bg-surface-hover hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
  'cursor-pointer',
)

export function LayersPanel() {
  const { layers, selectedLayerIds, addLayer, updateLayer, selectLayer, reorderLayer } =
    useCanvasStore(
      useShallow((s) => ({
        layers: s.layers,
        selectedLayerIds: s.selectedLayerIds,
        addLayer: s.addLayer,
        updateLayer: s.updateLayer,
        selectLayer: s.selectLayer,
        reorderLayer: s.reorderLayer,
      })),
    )

  const dragSourceId = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex)

  function handleDragStart(e: React.DragEvent, id: string) {
    dragSourceId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const sourceId = dragSourceId.current
    if (!sourceId || sourceId === targetId) return
    const targetIndex = layers.findIndex((l) => l.id === targetId)
    if (targetIndex !== -1) {
      reorderLayer(sourceId, targetIndex)
    }
    dragSourceId.current = null
  }

  function addTextLayer() {
    const layer: TextLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      name: 'Text',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      content: 'New Text',
      fontFamily: 'Space Grotesk',
      fontSize: 48,
      fontWeight: 500,
      color: '#141413',
      textAlign: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      textTransform: 'none',
    }
    addLayer(layer)
  }

  function addShapeLayer() {
    const layer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: 'shape',
      name: 'Rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      shapeType: 'rectangle',
      fill: '#141413',
    }
    addLayer(layer)
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        const layer: Layer = {
          id: crypto.randomUUID(),
          type: 'image',
          name: file.name.replace(/\.[^.]+$/, ''),
          x: 50,
          y: 50,
          width: Math.min(img.naturalWidth, 600),
          height: Math.min(img.naturalHeight, 600),
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: layers.length,
          src,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
        }
        addLayer(layer)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function addDeviceLayer() {
    const layer: Layer = {
      id: crypto.randomUUID(),
      type: 'device-frame',
      name: 'iPhone',
      x: 100,
      y: 100,
      width: 300,
      height: 600,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      deviceModel: 'iphone-16-pro-max',
      deviceColor: 'black-titanium',
      orientation: 'portrait',
    }
    addLayer(layer)
  }

  return (
    <div
      className={cn(
        'panel-chrome sidebar-shell--layers flex h-full min-h-0 w-full min-w-0 flex-col',
        'border-r border-border',
      )}
    >
      {/* Header — ALL CAPS mono, tertiary layer */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="mono-label-strong">Calques</span>
        {layers.length > 0 && (
          <span className="mono-label tabular-nums">
            {String(layers.length).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Layer list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {sortedLayers.length === 0 && (
          <div className="mt-4 px-3 py-6 text-center">
            <p className="mono-label mb-2">Empty</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Ajoutez du texte, une forme ou une image.
            </p>
          </div>
        )}
        {sortedLayers.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isSelected={selectedLayerIds.includes(layer.id)}
            onSelect={() => selectLayer(layer.id)}
            onToggleVisibility={() =>
              updateLayer(layer.id, { visible: !layer.visible })
            }
            onToggleLock={() =>
              updateLayer(layer.id, { locked: !layer.locked })
            }
            onRename={(name) => updateLayer(layer.id, { name })}
            onDragStart={(e) => handleDragStart(e, layer.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, layer.id)}
          />
        ))}
      </div>

      {/* Add tools — hairline-separated footer */}
      <div className="mt-auto shrink-0 border-t border-border px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Texte"
            aria-label="Add text layer"
            onClick={addTextLayer}
            className={addBtnCls}
          >
            <Type size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            title="Forme"
            aria-label="Add shape layer"
            onClick={addShapeLayer}
            className={addBtnCls}
          >
            <Square size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            title="Image"
            aria-label="Add image layer"
            onClick={() => fileInputRef.current?.click()}
            className={addBtnCls}
          >
            <ImageIcon size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            title="Cadre"
            aria-label="Add device frame layer"
            onClick={addDeviceLayer}
            className={addBtnCls}
          >
            <Smartphone size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFile}
        />
      </div>
    </div>
  )
}
