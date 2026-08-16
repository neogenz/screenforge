import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Download, FileCheck2, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useExport } from '@/hooks/use-export'
import { EXPORT_DIMENSIONS, PRIMARY_DIMENSION } from '@/lib/dimensions'
import { Dialog, DialogColumns } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { localeBlocked, localizedLayoutLayers, localizedScreens, reviewLocale } from '@/lib/locale'
import type { Project, Screen } from '@/types'

export function ExportDialog() {
  const showExportDialog = useUIStore((state) => state.showExportDialog)
  if (!showExportDialog) return null
  return <ExportDialogGate />
}

/* L'abonnement au projet ne vit que dialogue ouvert : monté en permanence, il
   re-rendait ce composant à chaque nudge pour retourner `null`. */
function ExportDialogGate() {
  const project = useProjectStore((state) => state.project)
  if (!project) return null
  return <ExportDialogContent project={project} />
}

function ExportDialogContent({ project }: { project: Project }) {
  const showExportDialog = useUIStore((state) => state.showExportDialog)
  const setShowExportDialog = useUIStore((state) => state.setShowExportDialog)
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>(() =>
    project.screens.map((screen) => screen.id),
  )
  /* Vide = la langue du projet. Une variante ne remplace jamais l'original :
     elle s'exporte à côté, sous son propre code. */
  const [localeCode, setLocaleCode] = useState('')
  const { exportBatch, isExporting, progress, error, completedFiles, clearError } = useExport()

  const locale = (project.locales ?? []).find((entry) => entry.code === localeCode)
  /* La revue tourne ici, pas seulement dans la boîte des langues : c'est le
     dernier point où un débordement peut encore être arrêté, et un utilisateur
     qui exporte n'a pas forcément rouvert la revue depuis sa dernière retouche. */
  const localeFindings = useMemo(
    () => (locale ? reviewLocale(project, locale) : []),
    [project, locale],
  )
  const localeRefused = Boolean(locale) && localeBlocked(localeFindings)

  const exportedScreens = useMemo(
    () => (locale ? localizedScreens(project, locale) : project.screens),
    [project, locale],
  )
  const exportedLayoutLayers = useMemo(
    () => (locale ? localizedLayoutLayers(project, locale) : project.layoutLayers),
    [project, locale],
  )

  const selectedScreens = useMemo(
    () =>
      exportedScreens.flatMap((screen, screenIndex) =>
        selectedScreenIds.includes(screen.id) ? [{ screen, screenIndex }] : [],
      ),
    [exportedScreens, selectedScreenIds],
  )
  const allScreensSelected = selectedScreenIds.length === project.screens.length

  const handleClose = useCallback(() => {
    if (!isExporting) setShowExportDialog(false)
  }, [isExporting, setShowExportDialog])

  const toggleAllScreens = useCallback(() => {
    clearError()
    setSelectedScreenIds(allScreensSelected ? [] : project.screens.map((screen) => screen.id))
  }, [allScreensSelected, clearError, project.screens])

  const toggleScreen = useCallback(
    (id: string) => {
      clearError()
      setSelectedScreenIds((previous) =>
        previous.includes(id) ? previous.filter((screenId) => screenId !== id) : [...previous, id],
      )
    },
    [clearError],
  )

  const [justExported, setJustExported] = useState(false)
  useEffect(() => {
    if (!justExported) return
    const timer = window.setTimeout(() => setJustExported(false), 1400)
    return () => window.clearTimeout(timer)
  }, [justExported])

  const handleExport = useCallback(async () => {
    if (selectedScreens.length === 0 || localeRefused) return
    try {
      await exportBatch(
        localeCode ? `${project.name}-${localeCode}` : project.name,
        selectedScreens,
        exportedLayoutLayers,
        EXPORT_DIMENSIONS,
      )
      /* Le téléchargement part en silence : le bouton qui vient de produire le
         lot le confirme une seconde, puis redevient une proposition. */
      setJustExported(true)
    } catch {
      // `useExport` exposes the actionable rendering error in this dialog.
    }
  }, [exportBatch, exportedLayoutLayers, localeCode, localeRefused, project.name, selectedScreens])

  return (
    <Dialog
      open={showExportDialog}
      onClose={handleClose}
      title="Export officiel"
      size="lg"
      flush
      headerActions={<span className="field-label px-1">App Store</span>}
      footerNote="Aucun téléchargement partiel en cas d’échec."
      footer={
        <>
          <Button variant="default" onClick={handleClose} disabled={isExporting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleExport()}
            loading={isExporting}
            disabled={selectedScreens.length === 0 || localeRefused}
          >
            {justExported ? (
              <Check size={12} aria-hidden className="animate-check-in" />
            ) : (
              !isExporting && <Download size={12} aria-hidden />
            )}
            {justExported ? 'Exporté' : isExporting ? 'Export en cours…' : 'Exporter le ZIP'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col">
        {/* Le rail est à droite : il récapitule ce que la colonne de gauche
            décide. Le passer à gauche pour uniformiser aurait mis le
            récapitulatif avant le travail, dans le DOM comme sous le curseur
            de tabulation. */}
        <DialogColumns
          railSide="end"
          railLabel="Profil d’export"
          contentLabel="Captures à exporter"
          rail={
            <>
              <div className="surface-inner p-4">
                <span className="field-label">Profil</span>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  iPhone {PRIMARY_DIMENSION.size}
                </p>
                <p className="tabular mt-1 text-sm text-muted-foreground">
                  {PRIMARY_DIMENSION.portrait.width}×{PRIMARY_DIMENSION.portrait.height} px
                </p>
                <div className="hairline my-3" />
                <ul className="flex flex-col gap-2 text-2xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check size={12} aria-hidden /> PNG · 8 bits
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={12} aria-hidden /> RGB opaque · sans alpha
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={12} aria-hidden /> Cible interne &lt; 5 MB
                  </li>
                </ul>
              </div>

              <div className="surface-inner p-4">
                <span className="field-label">Lot final</span>
                <p className="mt-1.5 text-xl font-medium tabular-nums text-foreground">
                  {selectedScreens.length}
                </p>
                <p className="text-2xs text-muted-foreground">
                  fichier{selectedScreens.length > 1 ? 's' : ''}
                  {' sous '}
                  <span className="font-mono">6.9/</span>
                </p>
              </div>

              <div className="surface-inner p-4">
                <span className="field-label">Langue</span>
                <Select
                  className="mt-1.5"
                  aria-label="Langue exportée"
                  value={localeCode}
                  disabled={isExporting}
                  onChange={(event) => setLocaleCode(event.target.value)}
                >
                  <option value="">Langue du projet</option>
                  {(project.locales ?? []).map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
                {/* Une langue qui déborde ne s'exporte pas, et la boîte dit
                    combien de lignes la retiennent — refuser sans compter
                    laisserait l'utilisateur chercher. */}
                {localeRefused && (
                  <p role="alert" className="mt-2 text-2xs text-destructive">
                    {localeFindings.length} texte{localeFindings.length > 1 ? 's' : ''} déborde
                    {localeFindings.length > 1 ? 'nt' : ''} ou manque
                    {localeFindings.length > 1 ? 'nt' : ''}. Corrigez-les dans « Langues » avant
                    d’exporter cette variante.
                  </p>
                )}
              </div>
            </>
          }
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="section-title">Captures</h3>
              <p className="mt-1 text-2xs text-muted-foreground">
                L’ordre du projet sera conservé dans le ZIP.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAllScreens}
              disabled={isExporting}
              className="field-label shrink-0 transition-colors hover:text-foreground"
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
        </DialogColumns>

        {(progress || error || completedFiles.length > 0) && (
          <div className="border-t border-border px-6 py-4" aria-live="polite">
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
                  ZIP validé et téléchargé · {completedFiles.length} fichier
                  {completedFiles.length > 1 ? 's' : ''}
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
        'transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        checked ? 'border-foreground bg-muted' : 'border-border hover:border-input',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-foreground bg-foreground text-card' : 'border-input bg-card',
        )}
      >
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
