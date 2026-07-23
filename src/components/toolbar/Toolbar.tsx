import { useRef, useState } from 'react'
import {
  Check,
  Download,
  LayoutTemplate,
  LoaderCircle,
  Moon,
  Redo2,
  Settings,
  Sun,
  TriangleAlert,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'

const SAVE_LABELS = {
  idle: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement',
} as const

export function Toolbar() {
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.past.length > 0)
  const canRedo = useHistoryStore((s) => s.future.length > 0)

  const {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    showExportDialog,
    showTemplatesPicker,
    showGlobalsEditor,
    setShowExportDialog,
    setShowTemplatesPicker,
    setShowGlobalsEditor,
    theme,
    toggleTheme,
    saveStatus,
  } = useUIStore(
    useShallow((s) => ({
      zoom: s.zoom,
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      resetZoom: s.resetZoom,
      showExportDialog: s.showExportDialog,
      showTemplatesPicker: s.showTemplatesPicker,
      showGlobalsEditor: s.showGlobalsEditor,
      setShowExportDialog: s.setShowExportDialog,
      setShowTemplatesPicker: s.setShowTemplatesPicker,
      setShowGlobalsEditor: s.setShowGlobalsEditor,
      theme: s.theme,
      toggleTheme: s.toggleTheme,
      saveStatus: s.saveStatus,
    })),
  )

  return (
    <div className="relative z-10 flex h-12 w-full items-center gap-2 border-b border-border bg-panel px-3">
      {/* Left — identity + history */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <ProjectName />

        <span
          role="status"
          aria-live="polite"
          className={cn(
            'mono-label ml-2 hidden shrink-0 items-center gap-1.5 md:flex',
            saveStatus === 'error' ? 'text-danger' : 'text-muted',
          )}
        >
          {saveStatus === 'saving' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
          {saveStatus === 'saved' && <Check size={11} className="text-success" aria-hidden />}
          {saveStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
          {SAVE_LABELS[saveStatus]}
        </span>
      </div>

      {/* Center — history + zoom */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          title="Annuler (⌘Z)"
          aria-label="Annuler"
          disabled={!canUndo}
          onClick={() => undo()}
          className="icon-btn"
        >
          <Undo2 size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="Rétablir (⌘⇧Z)"
          aria-label="Rétablir"
          disabled={!canRedo}
          onClick={() => redo()}
          className="icon-btn"
        >
          <Redo2 size={15} strokeWidth={1.75} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <div
          role="group"
          aria-label="Contrôles de zoom"
          className="flex h-8 items-center rounded-md border border-border bg-panel"
        >
          <button
            type="button"
            title="Zoom arrière (⌘-)"
            aria-label="Zoom arrière"
            onClick={zoomOut}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-l-[5px] text-muted',
              'transition-colors hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <ZoomOut size={14} strokeWidth={1.75} />
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            title="Ajuster aux écrans (⌘0)"
            aria-label="Ajuster le zoom aux écrans"
            onClick={resetZoom}
            className={cn(
              'mono-value min-w-[3.75rem] px-2 text-center text-[11px] text-foreground-muted',
              'transition-colors hover:text-foreground',
            )}
          >
            {Math.round(zoom * 100)}%
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            title="Zoom avant (⌘+)"
            aria-label="Zoom avant"
            onClick={zoomIn}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-r-[5px] text-muted',
              'transition-colors hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <ZoomIn size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Right — workspace actions */}
      <div className="flex flex-1 items-center justify-end gap-0.5">
        <button
          type="button"
          title="Modèles de mise en page"
          aria-label="Ouvrir les modèles"
          onClick={() => setShowTemplatesPicker(!showTemplatesPicker)}
          data-active={showTemplatesPicker || undefined}
          className="icon-btn"
        >
          <LayoutTemplate size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="Réglages globaux du projet"
          aria-label="Ouvrir les réglages globaux"
          onClick={() => setShowGlobalsEditor(!showGlobalsEditor)}
          data-active={showGlobalsEditor || undefined}
          className="icon-btn"
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label="Changer de thème"
          onClick={toggleTheme}
          className="icon-btn"
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>

        <button
          type="button"
          title="Exporter les captures App Store"
          aria-label="Ouvrir l’export"
          onClick={() => setShowExportDialog(!showExportDialog)}
          className="btn-accent ml-1.5"
        >
          <Download size={12} strokeWidth={2} />
          Exporter
        </button>
      </div>
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
        'h-8 w-44 min-w-0 truncate rounded-md border border-transparent bg-transparent px-2',
        'text-[13px] font-medium text-foreground transition-colors',
        'hover:border-border focus:border-border-strong focus:bg-panel-sub focus:outline-none',
      )}
    />
  )
}
