import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, Check, Download, FileCheck2, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useExport } from '@/hooks/use-export'
import { EXPORT_DIMENSIONS, PRIMARY_DIMENSION } from '@/lib/dimensions'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Project, Screen } from '@/types'

export function ExportDialog() {
  const showExportDialog = useUIStore((state) => state.showExportDialog)
  const project = useProjectStore((state) => state.project)

  if (!showExportDialog || !project) return null
  return <ExportDialogContent project={project} />
}

function ExportDialogContent({ project }: { project: Project }) {
  const showExportDialog = useUIStore((state) => state.showExportDialog)
  const setShowExportDialog = useUIStore((state) => state.setShowExportDialog)
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>(() =>
    project.screens.map((screen) => screen.id),
  )
  const { exportBatch, isExporting, progress, error, completedFiles, clearError } = useExport()

  const selectedScreens = useMemo(
    () => project.screens.flatMap((screen, screenIndex) =>
      selectedScreenIds.includes(screen.id) ? [{ screen, screenIndex }] : [],
    ),
    [project.screens, selectedScreenIds],
  )
  const allScreensSelected = selectedScreenIds.length === project.screens.length

  const handleClose = useCallback(() => {
    if (!isExporting) setShowExportDialog(false)
  }, [isExporting, setShowExportDialog])

  const toggleAllScreens = useCallback(() => {
    clearError()
    setSelectedScreenIds(allScreensSelected ? [] : project.screens.map((screen) => screen.id))
  }, [allScreensSelected, clearError, project.screens])

  const toggleScreen = useCallback((id: string) => {
    clearError()
    setSelectedScreenIds((previous) =>
      previous.includes(id)
        ? previous.filter((screenId) => screenId !== id)
        : [...previous, id],
    )
  }, [clearError])

  const handleExport = useCallback(async () => {
    if (selectedScreens.length === 0) return
    try {
      await exportBatch(project.name, selectedScreens, project.layoutLayers, EXPORT_DIMENSIONS)
    } catch {
      // useExport exposes the precise blocking error in the dialog.
    }
  }, [exportBatch, project.layoutLayers, project.name, selectedScreens])

  return (
    <Dialog
      open={showExportDialog}
      onClose={handleClose}
      title="Export officiel"
      size="lg"
      headerActions={<span className="field-label px-1">App Store</span>}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-2xs text-muted-foreground">
            Aucun téléchargement partiel en cas d’échec.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="default" onClick={handleClose} disabled={isExporting}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleExport()}
              loading={isExporting}
              disabled={selectedScreens.length === 0}
            >
              {!isExporting && <Download size={12} aria-hidden />}
              {isExporting ? 'Export en cours…' : 'Exporter le ZIP'}
            </Button>
          </div>
        </div>
      }
    >
      {/* -m-4 cancels the Dialog body padding so the columns stay flush. */}
      <div className="-m-4 flex flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_220px]">
          <section
            className="max-h-[52dvh] overflow-y-auto border-r border-border px-5 py-4"
            aria-labelledby="export-screens-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 id="export-screens-title" className="section-title">Captures</h3>
                <p className="mt-1 text-2xs text-muted-foreground">
                  L’ordre du projet sera conservé dans le ZIP.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAllScreens}
                disabled={isExporting}
                className="field-label transition-colors hover:text-foreground"
              >
                {allScreensSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {project.screens.map((screen, index) => (
                <ScreenChoice
                  key={screen.id}
                  screen={screen}
                  index={index}
                  checked={selectedScreenIds.includes(screen.id)}
                  disabled={isExporting}
                  onToggle={() => toggleScreen(screen.id)}
                />
              ))}
            </div>
          </section>

          <aside
            className="flex max-h-[52dvh] flex-col gap-4 overflow-y-auto px-4 py-4"
            aria-label="Profil d’export"
          >
            <div className="surface-inner p-3.5">
              <span className="field-label">Profil</span>
              <p className="mt-1.5 text-sm font-medium text-foreground">iPhone {PRIMARY_DIMENSION.size}</p>
              <p className="tabular mt-1 text-sm text-muted-foreground">
                {PRIMARY_DIMENSION.portrait.width}×{PRIMARY_DIMENSION.portrait.height} px
              </p>
              <div className="hairline my-3" />
              <ul className="flex flex-col gap-2 text-2xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={12} aria-hidden /> PNG · 8 bits</li>
                <li className="flex items-center gap-2"><Check size={12} aria-hidden /> RGB opaque · sans alpha</li>
                <li className="flex items-center gap-2"><Check size={12} aria-hidden /> Cible interne &lt; 5 MB</li>
              </ul>
            </div>

            <div className="surface-inner p-3.5">
              <span className="field-label">Lot final</span>
              <p className="mt-1.5 text-xl font-medium tabular-nums text-foreground">
                {selectedScreens.length}
              </p>
              <p className="text-2xs text-muted-foreground">
                fichier{selectedScreens.length > 1 ? 's' : ''} sous <span className="font-mono">6.9/</span>
              </p>
            </div>
          </aside>
        </div>

        {(progress || error || completedFiles.length > 0) && (
          <div className="border-t border-border px-5 py-3" aria-live="polite">
            {progress && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Loader size={13} className="animate-spin text-foreground" aria-hidden />
                  <span className="text-2xs text-foreground">{progress.label}</span>
                  <span className="tabular ml-auto text-2xs text-muted-foreground">
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
            {error && (
              <div role="alert" className="flex items-start gap-2 text-2xs text-destructive">
                <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            {!isExporting && !error && completedFiles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-2xs text-foreground">
                  <FileCheck2 size={13} aria-hidden />
                  ZIP validé et téléchargé · {completedFiles.length} fichier{completedFiles.length > 1 ? 's' : ''}
                </div>
                <ul className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {completedFiles.map((file) => (
                    <li key={file.path} className="flex items-baseline justify-between gap-3">
                      <span className="tabular min-w-0 truncate text-2xs text-muted-foreground">
                        {file.path}
                      </span>
                      <span className="tabular shrink-0 text-2xs text-muted-foreground">
                        {formatMegabytes(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

function ScreenChoice({
  screen,
  index,
  checked,
  disabled,
  onToggle,
}: {
  screen: Screen
  index: number
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left',
        'transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        checked ? 'border-foreground bg-muted' : 'border-border hover:border-input',
      )}
    >
      <span className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
        checked ? 'border-foreground bg-foreground text-card' : 'border-input bg-card',
      )}>
        {checked && <Check size={10} strokeWidth={2.5} aria-hidden />}
      </span>
      {screen.thumbnail ? (
        <img
          src={screen.thumbnail}
          alt=""
          className="h-10 w-[18px] shrink-0 rounded-xs border border-border object-cover"
        />
      ) : (
        <span className="h-10 w-[18px] shrink-0 rounded-xs border border-border bg-stage" />
      )}
      <span className="tabular w-5 shrink-0 text-2xs text-muted-foreground">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{screen.name}</span>
    </button>
  )
}
