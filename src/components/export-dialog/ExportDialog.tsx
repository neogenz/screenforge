import { useEffect, useState, useCallback, useMemo } from 'react'
import { X, Download, Loader } from 'lucide-react'
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

  // Reset selections when dialog opens (via timeout to avoid setState-in-effect lint error)
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
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }, [])

  const toggleDimension = useCallback((size: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(size) ? prev.filter((d) => d !== size) : [...prev, size]
    )
  }, [])

  const handleClose = useCallback(() => {
    if (!isExporting) setShowExportDialog(false)
  }, [isExporting, setShowExportDialog])

  // Escape to close
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
    // canvasJSON is not stored yet — we use an empty object as placeholder
    // The actual canvas JSON will come from the canvas hook once it's wired up
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
    selectedDimensions.includes(d.size)
  )
  const exportCount = selectedScreenIds.length * selectedDimObjs.length

  if (!showExportDialog) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-background rounded-xl shadow-xl p-6 w-[560px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Export Screenshots</h2>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'hover:bg-white/10',
              'focus:outline-none focus:ring-2 focus:ring-white/20',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            aria-label="Close export dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Screen Selection */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/70">Screens</h3>
            <button
              onClick={toggleAllScreens}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              {allScreensSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="space-y-2">
            {screens.map((screen) => (
              <label
                key={screen.id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer',
                  'border border-white/10 hover:border-white/20 transition-colors',
                  selectedScreenIds.includes(screen.id) && 'border-white/30 bg-white/5'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedScreenIds.includes(screen.id)}
                  onChange={() => toggleScreen(screen.id)}
                  className="w-4 h-4 accent-white rounded"
                />
                {screen.thumbnail && (
                  <img
                    src={screen.thumbnail}
                    alt={screen.name}
                    className="w-8 h-8 rounded object-cover bg-white/5"
                  />
                )}
                <span className="text-sm">{screen.name}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Dimension Selection */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-white/70 mb-3">Dimensions</h3>
          <div className="space-y-2">
            {EXPORT_DIMENSIONS.map((dim) => (
              <label
                key={dim.size}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer',
                  'border border-white/10 hover:border-white/20 transition-colors',
                  selectedDimensions.includes(dim.size) && 'border-white/30 bg-white/5'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedDimensions.includes(dim.size)}
                  onChange={() => toggleDimension(dim.size)}
                  className="w-4 h-4 accent-white rounded"
                />
                <span className="text-sm flex-1">
                  {dim.size}
                  {dim.isPrimary && (
                    <span className="ml-2 text-xs text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                      recommended
                    </span>
                  )}
                </span>
                <span className="text-xs text-white/40">
                  {dim.portrait.width}&times;{dim.portrait.height}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Progress */}
        {isExporting && progress && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Loader size={14} className="animate-spin" />
              <span className="text-sm text-white/70">{progress.label}</span>
              <span className="text-xs text-white/40 ml-auto">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/60 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExportCurrent}
            disabled={isExporting || screens.length === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
              'border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white/20',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Download size={14} />
            Export Current
          </button>
          <button
            onClick={handleExportSelected}
            disabled={isExporting || exportCount === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center',
              'bg-white text-black hover:bg-white/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white/20',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {isExporting
              ? 'Exporting...'
              : `Export ${exportCount > 0 ? `${exportCount} file${exportCount > 1 ? 's' : ''}` : 'Selected'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
