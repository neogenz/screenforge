import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, FileCheck2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useExport } from '@/hooks/use-export'
import { EXPORT_DIMENSIONS, PRIMARY_DIMENSION } from '@/lib/dimensions'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { DialogColumns } from '@/components/patterns/dialog-columns'
import { ProcessingPanel, type ProcessingStep } from '@/components/patterns/processing-panel'
import { StatusChip } from '@/components/patterns/status-chip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/patterns/select-field'
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
  const totalCompletedBytes = useMemo(
    () => completedFiles.reduce((sum, file) => sum + file.size, 0),
    [completedFiles],
  )

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

  /* Deux étapes, pas un pourcentage simulé : le rendu (une entrée par écran,
     `useExport` en tient le compte) puis l'archive, dont `useExport` ne dit
     que le début (« Validation et création du ZIP »). */
  const zipPhase = progress?.label.startsWith('Validation') ?? completedFiles.length > 0
  const renderStatus: ProcessingStep['status'] = error
    ? zipPhase
      ? 'done'
      : 'error'
    : zipPhase
      ? 'done'
      : progress
        ? 'running'
        : 'pending'
  const zipStatus: ProcessingStep['status'] = error
    ? zipPhase
      ? 'error'
      : 'pending'
    : completedFiles.length > 0
      ? 'done'
      : zipPhase
        ? 'running'
        : 'pending'
  const exportSteps: ProcessingStep[] = [
    {
      key: 'render',
      label:
        progress && !zipPhase
          ? progress.label
          : `Rendu ${selectedScreens.length} écran${selectedScreens.length > 1 ? 's' : ''}`,
      status: renderStatus,
      error: renderStatus === 'error' ? (error ?? undefined) : undefined,
    },
    {
      key: 'zip',
      label: 'Archive ZIP',
      status: zipStatus,
      error: zipStatus === 'error' ? (error ?? undefined) : undefined,
    },
  ]

  return (
    <DialogShell
      open={showExportDialog}
      onClose={handleClose}
      title="Export officiel"
      size="lg"
      flush
      headerActions={<span className="field-label px-1">App Store</span>}
      footerNote="Aucun téléchargement partiel en cas d’échec."
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isExporting}>
            Annuler
          </Button>
          {/* Le libellé ne change pas avec l'état : `loading` masque le texte et
              pose le Spinner par-dessus (bouton coss), l'icône seule dit le
              succès — le nom accessible du bouton reste stable pour qui l'exporte
              au clavier ou par script pendant le rendu. */}
          <Button
            variant="default"
            onClick={() => void handleExport()}
            loading={isExporting}
            disabled={selectedScreens.length === 0 || localeRefused}
          >
            {justExported ? (
              <Check size={12} aria-hidden className="animate-check-in" />
            ) : (
              <Download size={12} aria-hidden />
            )}
            Exporter le ZIP
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
                  {/* Le poids exact, pas une estimation : un PNG App Store varie
                      trop selon le contenu pour qu'un chiffre avancé avant le
                      rendu dise vrai. Il apparaît une fois connu. */}
                  {!isExporting && !error && completedFiles.length > 0 && (
                    <> · {formatMegabytes(totalCompletedBytes)}</>
                  )}
                </p>
                <StatusChip
                  className="mt-2"
                  tone={
                    isExporting
                      ? 'pulse'
                      : selectedScreens.length === 0 || localeRefused
                        ? 'warning'
                        : 'success'
                  }
                >
                  {isExporting
                    ? 'Export en cours'
                    : selectedScreens.length === 0
                      ? 'Aucun écran'
                      : localeRefused
                        ? 'Bloqué'
                        : 'Prêt'}
                </StatusChip>
              </div>

              <div className="surface-inner p-4">
                <span className="field-label">Langue</span>
                <SelectField
                  className="mt-1.5"
                  aria-label="Langue exportée"
                  value={localeCode}
                  disabled={isExporting}
                  onValueChange={setLocaleCode}
                  items={[
                    { value: '', label: 'Langue du projet' },
                    ...(project.locales ?? []).map((entry) => ({
                      value: entry.code,
                      label: entry.name,
                    })),
                  ]}
                />
                {/* Une langue qui déborde ne s'exporte pas, et la boîte dit
                    combien de lignes la retiennent — refuser sans compter
                    laisserait l'utilisateur chercher. */}
                {localeRefused && (
                  <Alert variant="error" className="mt-2 py-2">
                    <AlertTriangle aria-hidden />
                    <AlertDescription className="text-2xs">
                      {localeFindings.length} texte{localeFindings.length > 1 ? 's' : ''} déborde
                      {localeFindings.length > 1 ? 'nt' : ''} ou manque
                      {localeFindings.length > 1 ? 'nt' : ''}. Corrigez-les dans « Langues » avant
                      d’exporter cette variante.
                    </AlertDescription>
                  </Alert>
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
            <Button
              variant="ghost"
              size="xs"
              onClick={toggleAllScreens}
              disabled={isExporting}
              className="field-label shrink-0"
            >
              {allScreensSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
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

        {(progress || error) && (
          <div className="border-t border-border px-6 py-4">
            <ProcessingPanel
              title="Export du lot"
              steps={exportSteps}
              onRetry={error ? () => void handleExport() : undefined}
              retryPending={isExporting}
            />
          </div>
        )}
        {!isExporting && !error && completedFiles.length > 0 && (
          <div className="border-t border-border px-6 py-4" aria-live="polite">
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
    </DialogShell>
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
    <Button
      variant="ghost"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'h-auto min-h-14 w-full justify-start gap-3 rounded-md border px-3 py-2 text-left font-normal',
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
    </Button>
  )
}
