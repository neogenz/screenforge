import { Save, Undo2, Redo2, ZoomOut, ZoomIn, Settings, LayoutTemplate, Download, Sun, Moon, LoaderCircle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useHistoryStore } from '@/stores/history.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useUIStore } from '@/stores/ui.store'
import { saveCurrentProject } from '@/lib/storage'
import { cn } from '@/lib/utils'

const SAVE_LABELS = {
  idle: 'Unsaved',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Save failed',
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
    <div className="relative z-10 flex h-12 w-full items-center justify-between border-b border-border bg-panel px-3">
      {/* Left — file + history */}
      <div className="flex items-center gap-0.5">
        <button
          title="Save (Cmd+S)"
          aria-label="Save project"
          disabled={saveStatus === 'saving'}
          onClick={() => void saveCurrentProject().catch(() => undefined)}
          className="icon-btn"
        >
          {saveStatus === 'saving'
            ? <LoaderCircle className="animate-spin" size={15} strokeWidth={1.75} />
            : <Save size={15} strokeWidth={1.75} />}
        </button>

        <span className="sr-only" role="status" aria-live="polite">
          {saveStatus === 'saving' && 'Saving project'}
          {saveStatus === 'saved' && 'Project saved'}
          {saveStatus === 'error' && 'Project save failed'}
        </span>

        <span
          className={cn(
            'mono-label ml-1 hidden sm:inline',
            saveStatus === 'error' && 'text-red-600',
          )}
          aria-hidden="true"
        >
          {SAVE_LABELS[saveStatus]}
        </span>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <button
          title="Undo (Cmd+Z)"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => undo()}
          className="icon-btn"
          {...(!canUndo && { disabled: true })}
        >
          <Undo2 size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => redo()}
          className="icon-btn"
        >
          <Redo2 size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Center — flat segmented zoom with mono digits */}
      <div className="flex items-center">
        <div
          role="group"
          aria-label="Zoom controls"
          className="flex h-8 items-center rounded-md border border-border bg-panel"
        >
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={zoomOut}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-l-md text-muted',
              'hover:bg-surface-hover hover:text-foreground transition-colors',
            )}
          >
            <ZoomOut size={14} strokeWidth={1.75} />
          </button>

          <div className="h-4 w-px bg-border" />

          <button
            title="Reset zoom"
            aria-label="Reset zoom"
            onClick={resetZoom}
            className={cn(
              'mono-value min-w-[3.75rem] px-2 text-center text-[11px] text-foreground-muted',
              'hover:text-foreground transition-colors',
            )}
          >
            {Math.round(zoom * 100)}%
          </button>

          <div className="h-4 w-px bg-border" />

          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={zoomIn}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-r-md text-muted',
              'hover:bg-surface-hover hover:text-foreground transition-colors',
            )}
          >
            <ZoomIn size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Right — theme + project actions */}
      <div className="flex items-center gap-0.5">
        <button
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          aria-label="Toggle theme"
          onClick={toggleTheme}
          className="icon-btn"
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <button
          title="Globals"
          aria-label="Open globals editor"
          onClick={() => setShowGlobalsEditor(!showGlobalsEditor)}
          data-active={showGlobalsEditor || undefined}
          className="icon-btn"
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>

        <button
          title="Templates"
          aria-label="Open template picker"
          onClick={() => setShowTemplatesPicker(!showTemplatesPicker)}
          data-active={showTemplatesPicker || undefined}
          className="icon-btn"
        >
          <LayoutTemplate size={15} strokeWidth={1.75} />
        </button>

        {/* Export is the ONE accent moment per Nothing philosophy */}
        <button
          title="Export"
          aria-label="Open export dialog"
          onClick={() => setShowExportDialog(!showExportDialog)}
          className={cn('btn-primary btn-primary-sm ml-1.5')}
        >
          <Download size={12} strokeWidth={2} />
          Export
        </button>
      </div>
    </div>
  )
}
