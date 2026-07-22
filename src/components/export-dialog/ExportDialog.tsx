import { useEffect, useState, useCallback, useMemo } from 'react'
import { X, Download, Loader, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useExport } from '@/hooks/use-export'
import { EXPORT_DIMENSIONS, PRIMARY_DIMENSION } from '@/lib/dimensions'
import type { DisplayClass } from '@/types'

export function ExportDialog() {
  const showExportDialog = useUIStore((s) => s.showExportDialog)
  const setShowExportDialog = useUIStore((s) => s.setShowExportDialog)
  const project = useProjectStore((s) => s.project)
  const activeScreenId = useCanvasStore((s) => s.activeScreenId)

  const { exportSingle, exportBatch, isExporting, progress } = useExport()

  const screens = useMemo(() => project?.screens ?? [], [project?.screens])

  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([])
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([PRIMARY_DIMENSION.size])

  useEffect(() => {
    if (!showExportDialog) return
    const t = setTimeout(() => {
      setSelectedScreenIds(screens.map((s) => s.id))
      setSelectedDimensions([PRIMARY_DIMENSION.size])
    }, 0)
    return () => clearTimeout(t)
  }, [showExportDialog]) // eslint-disable-line react-hooks/exhaustive-deps

  const allScreensSelected = selectedScreenIds.length === screens.length
  const toggleAllScreens = useCallback(() => {
    setSelectedScreenIds(allScreensSelected ? [] : screens.map((s) => s.id))
  }, [allScreensSelected, screens])

  const toggleScreen = useCallback((id: string) => {
    setSelectedScreenIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }, [])

  const toggleDimension = useCallback((size: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(size) ? prev.filter((d) => d !== size) : [...prev, size],
    )
  }, [])

  const handleClose = useCallback(() => {
    if (!isExporting) setShowExportDialog(false)
  }, [isExporting, setShowExportDialog])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    if (showExportDialog) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [showExportDialog, handleClose])

  const handleExportCurrent = useCallback(async () => {
    const activeScreen = screens.find((s) => s.id === activeScreenId) ?? screens[0]
    if (!activeScreen) return
    const dim = EXPORT_DIMENSIONS.find((d) => d.size === PRIMARY_DIMENSION.size) ?? EXPORT_DIMENSIONS[0]
    await exportSingle({}, activeScreen.name, dim)
  }, [screens, activeScreenId, exportSingle])

  const handleExportSelected = useCallback(async () => {
    const selectedScreens = screens
      .filter((s) => selectedScreenIds.includes(s.id))
      .map((s) => ({ canvasJSON: {} as object, name: s.name }))

    const dims = EXPORT_DIMENSIONS.filter((d) => selectedDimensions.includes(d.size))

    if (selectedScreens.length === 0 || dims.length === 0) return

    await exportBatch(selectedScreens, dims)
  }, [screens, selectedScreenIds, selectedDimensions, exportBatch])

  const selectedDimObjs: DisplayClass[] = EXPORT_DIMENSIONS.filter((d) =>
    selectedDimensions.includes(d.size),
  )
  const exportCount = selectedScreenIds.length * selectedDimObjs.length

  if (!showExportDialog) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] animate-[fade-in_0.14s_ease-out]"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export screenshots"
        className={cn(
          'w-[560px] max-w-[calc(100vw-40px)] max-h-[80vh] flex flex-col overflow-hidden',
          'surface-modal',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="mono-label">Export</span>
            <h2 className="text-[15px] font-medium text-foreground">Screenshots</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            aria-label="Close export dialog"
            className="icon-btn"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {/* Screens */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="mono-label-strong">Screens</h3>
              <button
                onClick={toggleAllScreens}
                className="mono-label hover:text-foreground transition-colors"
              >
                {allScreensSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {screens.map((screen) => {
                const checked = selectedScreenIds.includes(screen.id)
                return (
                  <label
                    key={screen.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5',
                      'transition-colors duration-100 ease-out',
                      checked
                        ? 'border-foreground bg-panel-sub'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <Checkbox checked={checked} onToggle={() => toggleScreen(screen.id)} />
                    {screen.thumbnail ? (
                      <img
                        src={screen.thumbnail}
                        alt={screen.name}
                        className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-sm border border-border bg-panel-muted" />
                    )}
                    <span className="flex-1 truncate text-[13px] text-foreground">{screen.name}</span>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Dimensions */}
          <section>
            <h3 className="mono-label-strong mb-3 block">Dimensions</h3>
            <div className="flex flex-col gap-1">
              {EXPORT_DIMENSIONS.map((dim) => {
                const checked = selectedDimensions.includes(dim.size)
                return (
                  <label
                    key={dim.size}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5',
                      'transition-colors duration-100 ease-out',
                      checked
                        ? 'border-foreground bg-panel-sub'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <Checkbox checked={checked} onToggle={() => toggleDimension(dim.size)} />
                    <span className="flex-1 text-[13px] text-foreground">
                      {dim.size}
                      {dim.isPrimary && (
                        <span className="mono-label ml-2">Primary</span>
                      )}
                    </span>
                    <span className="mono-value text-[11px] text-foreground-muted">
                      {dim.portrait.width}×{dim.portrait.height}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Progress */}
          {isExporting && progress && (
            <div className="surface-inner px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Loader size={13} className="animate-spin text-foreground" />
                <span className="mono-label-strong">{progress.label}</span>
                <span className="mono-value ml-auto text-[10px] text-foreground-muted">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-0.5 overflow-hidden bg-border">
                <div
                  className="h-full bg-foreground transition-[width] duration-300 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={handleExportCurrent}
            disabled={isExporting || screens.length === 0}
            className="btn-secondary"
          >
            <Download size={12} strokeWidth={1.5} />
            Current only
          </button>
          <button
            type="button"
            onClick={handleExportSelected}
            disabled={isExporting || exportCount === 0}
            className="btn-primary"
          >
            {isExporting ? (
              <Loader size={12} className="animate-spin" />
            ) : (
              <Download size={12} strokeWidth={1.5} />
            )}
            {isExporting
              ? 'Exporting…'
              : exportCount > 0
                ? `Export ${exportCount} file${exportCount > 1 ? 's' : ''}`
                : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Checkbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-100 ease-out',
        checked
          ? 'border-foreground bg-foreground text-panel'
          : 'border-border-strong bg-panel',
      )}
    >
      {checked && <Check size={10} strokeWidth={2.5} />}
    </button>
  )
}
