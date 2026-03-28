import { Save, Undo2, Redo2, ZoomOut, ZoomIn, Settings, LayoutTemplate, Download, Sun, Moon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useHistoryStore } from '@/stores/history.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'

export function Toolbar() {
  const undo = useHistoryStore((s) => s.undo)
  const redo = useHistoryStore((s) => s.redo)
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0)
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0)

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
    })),
  )

  const iconBtn = (disabled = false, active = false) =>
    cn(
      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
      'text-muted hover:text-foreground hover:bg-surface-hover',
      active && 'bg-primary/15 text-primary',
      disabled && 'opacity-30 pointer-events-none',
    )

  return (
    <div className="relative z-10 flex h-11 w-full items-center justify-between border-b border-border bg-panel px-4">
      {/* Left */}
      <div className="flex items-center gap-1">
        <button
          title="Save (Cmd+S)"
          aria-label="Save project"
          onClick={() => console.log('save')}
          className={iconBtn()}
        >
          <Save size={15} strokeWidth={1.75} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-white/[0.06]" />

        <button
          title="Undo (Cmd+Z)"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => undo()}
          className={iconBtn(!canUndo)}
        >
          <Undo2 size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => redo()}
          className={iconBtn(!canRedo)}
        >
          <Redo2 size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Center — zoom */}
      <div className="flex items-center gap-1">
        <button
          title="Zoom out"
          aria-label="Zoom out"
          onClick={zoomOut}
          className={iconBtn()}
        >
          <ZoomOut size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Reset zoom"
          aria-label="Reset zoom"
          onClick={resetZoom}
          className="min-w-[3.5rem] rounded-lg px-2 py-1 text-center text-[11px] font-medium tabular-nums text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          title="Zoom in"
          aria-label="Zoom in"
          onClick={zoomIn}
          className={iconBtn()}
        >
          <ZoomIn size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          aria-label="Toggle theme"
          onClick={toggleTheme}
          className={iconBtn()}
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>

        <div className="mx-0.5 h-4 w-px bg-border" />

        <button
          title="Globals"
          aria-label="Open globals editor"
          onClick={() => setShowGlobalsEditor(!showGlobalsEditor)}
          className={iconBtn(false, showGlobalsEditor)}
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Templates"
          aria-label="Open template picker"
          onClick={() => setShowTemplatesPicker(!showTemplatesPicker)}
          className={iconBtn(false, showTemplatesPicker)}
        >
          <LayoutTemplate size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Export"
          aria-label="Open export dialog"
          onClick={() => setShowExportDialog(!showExportDialog)}
          className={iconBtn(false, showExportDialog)}
        >
          <Download size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
