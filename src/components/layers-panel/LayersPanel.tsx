import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ImageIcon, Smartphone, Square, Type } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { LayerItem } from './LayerItem'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/components/canvas/canvas-utils'
import { CURRENT_DEVICE_FRAMES, getDefaultDeviceSize, getDeviceFrame } from '@/assets/device-frames'
import { cn } from '@/lib/utils'
import type { DeviceModel, Layer, ShapeLayer, TextLayer } from '@/types'

export function LayersPanel() {
  const {
    layers,
    selectedLayerIds,
    addLayer,
    selectLayer,
    selectLayers,
    reorderLayer,
  } = useCanvasStore(
    useShallow((state) => ({
      layers: state.layers,
      selectedLayerIds: state.selectedLayerIds,
      addLayer: state.addLayer,
      selectLayer: state.selectLayer,
      selectLayers: state.selectLayers,
      reorderLayer: state.reorderLayer,
    })),
  )

  const dragSourceId = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const layerGroups = [
    {
      label: 'Partagé · tous les écrans',
      layers: layers
        .filter((layer) => layer.scope === 'layout')
        .sort((first, second) => second.zIndex - first.zIndex),
    },
    {
      label: 'Cet écran',
      layers: layers
        .filter((layer) => layer.scope !== 'layout')
        .sort((first, second) => second.zIndex - first.zIndex),
    },
  ].filter((group) => group.layers.length > 0)

  function handleSelect(event: React.MouseEvent, layer: Layer) {
    if (event.metaKey || event.ctrlKey) {
      selectLayers(
        selectedLayerIds.includes(layer.id)
          ? selectedLayerIds.filter((id) => id !== layer.id)
          : [...selectedLayerIds, layer.id],
      )
    } else {
      selectLayer(layer.id)
    }
  }

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
      name: 'Texte',
      x: (SCREEN_WIDTH - 320) / 2,
      y: 160,
      width: 300,
      height: 80,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      content: 'Titre accrocheur',
      fontFamily: 'Space Grotesk',
      fontSize: 48,
      fontWeight: 700,
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
      x: (SCREEN_WIDTH - 200) / 2,
      y: (SCREEN_HEIGHT - 200) / 2,
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
      const width = Math.max(1, image.width * scale)
      const height = Math.max(1, image.height * scale)
      addLayer({
        id: crypto.randomUUID(),
        type: 'image',
        name: file.name.replace(/\.[^.]+$/, '') || 'Image',
        x: Math.max(0, (SCREEN_WIDTH - width) / 2),
        y: Math.max(0, (SCREEN_HEIGHT - height) / 2),
        width,
        height,
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

  function addDeviceLayer(model: DeviceModel) {
    const config = getDeviceFrame(model)
    const { width, height } = getDefaultDeviceSize(model)
    addLayer({
      id: crypto.randomUUID(),
      type: 'device-frame',
      name: 'iPhone',
      x: (SCREEN_WIDTH - width) / 2,
      y: SCREEN_HEIGHT - height - 120,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: layers.length,
      deviceModel: model,
      deviceColor: config.colors[0].name,
      orientation: 'portrait',
    })
  }

  return (
    <div className="panel-chrome sidebar-shell--layers flex h-full min-h-0 w-full min-w-0 flex-col border-r border-border">
      <div className="shrink-0 border-b border-border p-2">
        <div className="grid grid-cols-4 gap-1">
          <AddButton label="Texte" onClick={addTextLayer}><Type size={15} strokeWidth={1.5} aria-hidden /></AddButton>
          <DeviceAddButton onSelect={addDeviceLayer} />
          <AddButton label="Image" onClick={() => fileInputRef.current?.click()}><ImageIcon size={15} strokeWidth={1.5} aria-hidden /></AddButton>
          <AddButton label="Forme" onClick={addShapeLayer}><Square size={15} strokeWidth={1.5} aria-hidden /></AddButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="sr-only"
          aria-label="Importer une image"
          onChange={(event) => void handleImageFile(event)}
        />
        {fileError && (
          <p role="alert" className="px-1 pt-2 text-[11px] leading-relaxed text-danger">
            {fileError}
          </p>
        )}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
        role="listbox"
        aria-label="Calques"
        aria-multiselectable="true"
      >
        <div className="flex items-center justify-between px-2 pb-1 pt-2.5">
          <span className="mono-label-strong">Calques</span>
          {layers.length > 0 && (
            <span className="mono-label tabular-nums">{String(layers.length).padStart(2, '0')}</span>
          )}
        </div>
        {layers.length === 0 && (
          <div className="mt-2 px-3 py-6 text-center">
            <p className="text-[11px] leading-relaxed text-muted">
              Écran vide. Ajoutez un cadre iPhone, du texte ou une image ci-dessus.
            </p>
          </div>
        )}
        {layerGroups.map((group) => (
          <div key={group.label}>
            {layerGroups.length > 1 && (
              <p className="mono-label px-2 pb-1 pt-3">{group.label}</p>
            )}
            {group.layers.map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerIds.includes(layer.id)}
                onSelect={(event) => handleSelect(event, layer)}
                onSelectExclusive={() => selectLayer(layer.id)}
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
    </div>
  )
}

function DeviceAddButton({ onSelect }: { onSelect: (model: DeviceModel) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const preferredModel = useProjectStore((s) => s.project?.globals.deviceModel)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const models = [...CURRENT_DEVICE_FRAMES].sort((a, b) =>
    Number(b.model === preferredModel) - Number(a.model === preferredModel),
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Ajouter : cadre iPhone"
        aria-label="Ajouter un cadre iPhone"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-12 w-full flex-col items-center justify-center gap-1 rounded-md',
          'border border-border bg-panel-sub text-foreground-muted',
          'transition-colors duration-100 ease-out',
          'hover:border-border-strong hover:bg-surface-hover hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
        )}
      >
        <Smartphone size={15} strokeWidth={1.5} aria-hidden />
        <span className="mono-label flex items-center gap-0.5">
          Cadre
          <ChevronDown size={9} strokeWidth={2} aria-hidden />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Modèle d’iPhone"
          className={cn(
            'menu-shadow absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-panel p-1',
            'animate-menu-in origin-top',
          )}
        >
          {models.map((frame) => (
            <button
              key={frame.model}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(frame.model)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left',
                'transition-colors duration-100 ease-out hover:bg-surface-hover',
              )}
            >
              <span className="text-[12px] text-foreground">{frame.modelName}</span>
              <span className="mono-value text-[10px] text-muted">{frame.screenSize}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddButton({ label, onClick, children }: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={`Ajouter : ${label}`}
      aria-label={`Ajouter ${label}`}
      onClick={onClick}
      className={cn(
        'flex h-12 flex-col items-center justify-center gap-1 rounded-md',
        'border border-border bg-panel-sub text-foreground-muted',
        'transition-colors duration-100 ease-out',
        'hover:border-border-strong hover:bg-surface-hover hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
      )}
    >
      {children}
      <span className="mono-label">{label}</span>
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
