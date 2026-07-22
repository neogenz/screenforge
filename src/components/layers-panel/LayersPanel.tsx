import { useRef, useState } from 'react'
import { ImageIcon, Smartphone, Square, Type } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { LayerItem } from './LayerItem'
import { useCanvasStore } from '@/stores/canvas.store'
import { cn } from '@/lib/utils'
import type { Layer, ShapeLayer, TextLayer } from '@/types'

const addButtonClass = cn(
  'flex h-11 w-11 items-center justify-center rounded-md text-muted',
  'cursor-pointer transition-colors duration-100 ease-out',
  'hover:bg-surface-hover hover:text-foreground',
  'focus-visible:ring-1 focus-visible:ring-border-strong',
)

export function LayersPanel() {
  const {
    layers,
    selectedLayerIds,
    addLayer,
    removeLayer,
    updateLayer,
    selectLayer,
    reorderLayer,
    duplicateLayer,
  } = useCanvasStore(
    useShallow((state) => ({
      layers: state.layers,
      selectedLayerIds: state.selectedLayerIds,
      addLayer: state.addLayer,
      removeLayer: state.removeLayer,
      updateLayer: state.updateLayer,
      selectLayer: state.selectLayer,
      reorderLayer: state.reorderLayer,
      duplicateLayer: state.duplicateLayer,
    })),
  )

  const dragSourceId = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const layerGroups = [
    {
      label: 'Panorama',
      layers: layers
        .filter((layer) => layer.scope === 'layout')
        .sort((first, second) => second.zIndex - first.zIndex),
    },
    {
      label: 'Écran',
      layers: layers
        .filter((layer) => layer.scope !== 'layout')
        .sort((first, second) => second.zIndex - first.zIndex),
    },
  ].filter((group) => group.layers.length > 0)

  function handleDragStart(event: React.DragEvent, id: string) {
    dragSourceId.current = id
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(event: React.DragEvent, target: Layer) {
    event.preventDefault()
    const sourceId = dragSourceId.current
    const source = layers.find((layer) => layer.id === sourceId)
    if (source && source.id !== target.id && source.scope === target.scope) {
      reorderLayer(source.id, target.zIndex)
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
      width: 300,
      height: 80,
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

  async function handleImageFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileError(null)
    event.target.value = ''
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setFileError('Format non pris en charge. Utilisez un PNG, JPEG ou SVG.')
      return
    }

    try {
      const src = await readAsDataUrl(file)
      const image = await decodeImage(src)
      const scale = Math.min(600 / image.width, 600 / image.height, 1)
      addLayer({
        id: crypto.randomUUID(),
        type: 'image',
        name: file.name.replace(/\.[^.]+$/, '') || 'Image',
        x: 50,
        y: 50,
        width: Math.max(1, image.width * scale),
        height: Math.max(1, image.height * scale),
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: layers.length,
        src,
        originalWidth: image.width,
        originalHeight: image.height,
      })
    } catch {
      setFileError("L'image est illisible ou endommagée.")
    }
  }

  function addDeviceLayer() {
    addLayer({
      id: crypto.randomUUID(),
      type: 'device-frame',
      name: 'iPhone',
      x: 100,
      y: 100,
      width: 284,
      height: 600,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      deviceModel: 'iphone-16-pro-max',
      deviceColor: 'black-titanium',
      orientation: 'portrait',
    })
  }

  return (
    <div className="panel-chrome sidebar-shell--layers flex h-full min-h-0 w-full min-w-0 flex-col border-r border-border">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="mono-label-strong">Calques</span>
        {layers.length > 0 && (
          <span className="mono-label tabular-nums">{String(layers.length).padStart(2, '0')}</span>
        )}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5"
        role="listbox"
        aria-label="Layers"
        aria-multiselectable="true"
      >
        {layers.length === 0 && (
          <div className="mt-4 px-3 py-6 text-center">
            <p className="mono-label mb-2">Empty</p>
            <p className="text-[11px] leading-relaxed text-muted">Ajoutez du texte, une forme ou une image.</p>
          </div>
        )}
        {layerGroups.map((group) => (
          <div key={group.label}>
            {layerGroups.length > 1 && (
              <p className="mono-label px-2 pb-1 pt-2">{group.label}</p>
            )}
            {group.layers.map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerIds.includes(layer.id)}
                onSelect={() => selectLayer(layer.id)}
                onToggleVisibility={() => updateLayer(layer.id, { visible: !layer.visible })}
                onToggleLock={() => updateLayer(layer.id, { locked: !layer.locked })}
                onRename={(name) => updateLayer(layer.id, { name })}
                onDuplicate={() => duplicateLayer(layer.id)}
                onDelete={() => removeLayer(layer.id)}
                onMoveForward={() => reorderLayer(
                  layer.id,
                  Math.min(group.layers.length - 1, layer.zIndex + 1),
                )}
                onMoveBackward={() => reorderLayer(layer.id, Math.max(0, layer.zIndex - 1))}
                onDragStart={(event) => handleDragStart(event, layer.id)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => handleDrop(event, layer)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto shrink-0 border-t border-border px-2 py-1.5">
        {fileError && (
          <p role="alert" className="px-1 pb-1.5 text-[11px] leading-relaxed text-danger">
            {fileError}
          </p>
        )}
        <div className="flex items-center gap-0.5">
          <AddButton label="Add text layer" title="Texte" onClick={addTextLayer}><Type size={14} strokeWidth={1.5} aria-hidden /></AddButton>
          <AddButton label="Add shape layer" title="Forme" onClick={addShapeLayer}><Square size={14} strokeWidth={1.5} aria-hidden /></AddButton>
          <AddButton label="Add image layer" title="Image" onClick={() => fileInputRef.current?.click()}><ImageIcon size={14} strokeWidth={1.5} aria-hidden /></AddButton>
          <AddButton label="Add device frame layer" title="Cadre" onClick={addDeviceLayer}><Smartphone size={14} strokeWidth={1.5} aria-hidden /></AddButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="sr-only"
          aria-label="Import image layer"
          onChange={(event) => void handleImageFile(event)}
        />
      </div>
    </div>
  )
}

function AddButton({ label, title, onClick, children }: {
  label: string
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" title={title} aria-label={label} onClick={onClick} className={addButtonClass}>
      {children}
    </button>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

function decodeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Unable to decode image'))
    image.src = src
  })
}
