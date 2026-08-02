import { useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Download,
  ImageIcon,
  LayoutTemplate,
  LoaderCircle,
  Moon,
  PanelLeft,
  PanelRight,
  Redo2,
  Settings,
  Smartphone,
  Square,
  Sun,
  TriangleAlert,
  Type,
  Undo2,
} from 'lucide-react'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore, type SaveStatus } from '@/stores/ui.store'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import {
  createDeviceLayer,
  createShapeLayer,
  createTextLayer,
} from '@/lib/layer-factories'
import { CURRENT_DEVICE_FRAMES } from '@/assets/device-frames'
import type { DeviceModel, Layer } from '@/types'

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement',
}

function Divider() {
  return <div aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
}

/** Unique top bar: project identity, layer tools, workspace toggles, export. */
export function TopBar() {
  return (
    <div className="island relative flex h-11 items-center gap-1 px-1.5">
      <ProjectSegment />
      <ToolsSegment />
      <ActionsSegment />
    </div>
  )
}

function ProjectSegment() {
  const saveStatus = useUIStore((s) => s.saveStatus)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px] bg-export" />
      <ProjectName />
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'caps-label hidden shrink-0 items-center gap-1.5 xl:flex',
          saveStatus === 'error' ? 'text-danger' : 'text-faint',
        )}
      >
        {saveStatus === 'saving' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
        {saveStatus === 'saved' && <Check size={11} className="text-success" aria-hidden />}
        {saveStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
        {SAVE_LABELS[saveStatus]}
      </span>
    </div>
  )
}

function ProjectName() {
  const name = useProjectStore((s) => s.project?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [prevName, setPrevName] = useState(name)
  if (name !== prevName) {
    setPrevName(name)
    if (!editing) setDraft(name)
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) updateProjectName(trimmed)
    setEditing(false)
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          inputRef.current?.blur()
        }
        if (event.key === 'Escape') {
          setDraft(name)
          setEditing(false)
          inputRef.current?.blur()
        }
      }}
      aria-label="Nom du projet"
      spellCheck={false}
      className={cn(
        'h-8 w-36 min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5',
        'text-[13px] font-medium tracking-[-0.01em] text-foreground transition-colors',
        'hover:border-border focus:border-border-strong focus:bg-raised focus:outline-none',
      )}
    />
  )
}

function ToolsSegment() {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)

  function addLayer(layer: Layer) {
    useCanvasStore.getState().addLayer(layer)
  }

  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5">
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
      <DeviceAddTool
        onSelect={(model) =>
          addLayer(createDeviceLayer(model, useCanvasStore.getState().layers.length))
        }
      />
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
    </div>
  )
}

function ActionsSegment() {
  const layersOpen = useUIStore((s) => s.layersOpen)
  const propsOpen = useUIStore((s) => s.propsOpen)
  const showTemplatesPicker = useUIStore((s) => s.showTemplatesPicker)
  const showGlobalsEditor = useUIStore((s) => s.showGlobalsEditor)
  const theme = useUIStore((s) => s.theme)

  return (
    <div className="ml-auto flex items-center gap-0.5">
      <IconButton
        aria-label="Basculer le panneau Calques"
        title="Panneau Calques (⌘⇧L)"
        active={layersOpen}
        onClick={() => useUIStore.getState().toggleLayers()}
      >
        <PanelLeft size={15} strokeWidth={1.75} />
      </IconButton>
      <IconButton
        aria-label="Basculer le panneau Propriétés"
        title="Panneau Propriétés (⌘⇧P)"
        active={propsOpen}
        onClick={() => useUIStore.getState().toggleProps()}
      >
        <PanelRight size={15} strokeWidth={1.75} />
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
      <button
        type="button"
        aria-label="Ouvrir la palette de commandes"
        title="Palette de commandes (⌘K)"
        onClick={() => useUIStore.getState().setShowCommandPalette(true)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-faint',
          'transition-colors duration-150 ease-out hover:bg-raised-hover hover:text-foreground',
        )}
      >
        <Kbd>⌘K</Kbd>
      </button>

      <Button
        variant="primary"
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
