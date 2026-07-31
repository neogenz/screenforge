import { useRef, useState } from 'react'
import {
  ChevronDown,
  Download,
  ImageIcon,
  LayoutTemplate,
  Moon,
  Redo2,
  Settings,
  Smartphone,
  Square,
  Sun,
  Type,
  Undo2,
} from 'lucide-react'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import {
  createDeviceLayer,
  createShapeLayer,
  createTextLayer,
} from '@/lib/layer-factories'
import { CURRENT_DEVICE_FRAMES } from '@/assets/device-frames'
import type { DeviceModel, Layer } from '@/types'

function Divider() {
  return <div aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
}

/** Floating top-center toolbar: history, layer tools, workspace actions, export. */
export function Toolbar() {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const theme = useUIStore((s) => s.theme)

  function addLayer(layer: Layer) {
    useCanvasStore.getState().addLayer(layer)
  }

  return (
    <div className="island flex h-11 items-center gap-0.5 px-1.5">
      <IconButton
        aria-label="Annuler"
        title="Annuler (⌘Z)"
        disabled={!canUndo}
        onClick={() => undo()}
      >
        <Undo2 size={15} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Rétablir"
        title="Rétablir (⌘⇧Z)"
        disabled={!canRedo}
        onClick={() => redo()}
      >
        <Redo2 size={15} strokeWidth={1.75} />
      </IconButton>

      <Divider />

      <IconButton
        aria-label="Ajouter Texte"
        title="Ajouter : texte"
        onClick={() => addLayer(createTextLayer(useCanvasStore.getState().layers.length))}
      >
        <Type size={15} strokeWidth={1.75} />
      </IconButton>
      <DeviceAddTool onSelect={(model) =>
        addLayer(createDeviceLayer(model, useCanvasStore.getState().layers.length))
      } />
      <IconButton
        aria-label="Ajouter Image"
        title="Ajouter : image"
        onClick={() => document.getElementById('sf-image-import-input')?.click()}
      >
        <ImageIcon size={15} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ajouter Forme"
        title="Ajouter : forme"
        onClick={() => addLayer(createShapeLayer(useCanvasStore.getState().layers.length))}
      >
        <Square size={15} strokeWidth={1.75} />
      </IconButton>

      <Divider />

      <IconButton
        aria-label="Ouvrir les modèles"
        title="Modèles de mise en page"
        active={showTemplatesPicker}
        onClick={() => useUIStore.getState().setShowTemplatesPicker(!showTemplatesPicker)}
      >
        <LayoutTemplate size={15} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Ouvrir les réglages globaux"
        title="Réglages globaux du projet"
        active={showGlobalsEditor}
        onClick={() => useUIStore.getState().setShowGlobalsEditor(!showGlobalsEditor)}
      >
        <Settings size={15} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Changer de thème"
        title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        onClick={() => useUIStore.getState().toggleTheme()}
      >
        {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
      </IconButton>

      <Button
        variant="accent"
        size="md"
        aria-label="Ouvrir l’export"
        title="Exporter les captures App Store"
        onClick={() => useUIStore.getState().setShowExportDialog(true)}
        className="ml-1"
      >
        <Download size={12} strokeWidth={2} aria-hidden />
        Exporter
      </Button>
    </div>
  )
}

function DeviceAddTool({ onSelect }: { onSelect: (model: DeviceModel) => void }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const preferredModel = useProjectStore((s) => s.project?.globals.deviceModel)

  const models = [...CURRENT_DEVICE_FRAMES].sort((a, b) =>
    Number(b.model === preferredModel) - Number(a.model === preferredModel),
  )

  return (
    <>
      <IconButton
        ref={anchorRef}
        aria-label="Ajouter un cadre iPhone"
        title="Ajouter : cadre iPhone"
        aria-haspopup="menu"
        aria-expanded={open}
        active={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Smartphone size={15} strokeWidth={1.75} />
        <ChevronDown size={9} strokeWidth={2} aria-hidden className="-ml-0.5" />
      </IconButton>
      <Dropdown
        open={open}
        anchor={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel="Modèle d’iPhone"
        items={models.map((frame) => ({
          id: frame.model,
          label: frame.modelName,
          meta: frame.screenSize,
          onSelect: () => onSelect(frame.model),
        }))}
      />
    </>
  )
}
