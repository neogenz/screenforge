import { useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, ImageUp, RefreshCw } from 'lucide-react'
import { registerAsset, resolveAsset } from '@/lib/assets'
import {
  applyRefresh,
  assignManually,
  describeFiles,
  pendingChanges,
  planRefresh,
  refreshTargets,
  type ImportedScreenshot,
  type RefreshFile,
  type RefreshPlan,
  type RefreshTarget,
} from '@/lib/batch-refresh'
import {
  imageImportErrorMessage,
  importImageFile,
  SCREENSHOT_IMAGE_ACCEPT,
  SCREENSHOT_IMAGE_TYPES,
} from '@/lib/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project } from '@/types'

/**
 * Le remplacement d'une livraison entière de captures, en un geste.
 *
 * C'est la boîte qui rend une campagne remaintenable : à la release suivante,
 * dix fichiers sortent du simulateur et rien d'autre du projet ne doit bouger.
 * Elle propose l'appariement, montre ce qu'elle n'a pas su apparier, laisse
 * corriger, puis écrit tout d'un coup — un seul pas d'annulation pour les dix.
 *
 * Les fichiers sont décodés avant qu'aucune décision ne soit prise : un
 * fichier illisible arrête l'import entier, et le projet n'a rien vu. C'est le
 * même contrat que la transaction, un cran plus tôt.
 */
export function RefreshDialog() {
  const showRefreshDialog = useUIStore((state) => state.showRefreshDialog)
  const project = useProjectStore((state) => state.project)

  if (!showRefreshDialog || !project) return null
  return <RefreshDialogContent project={project} />
}

function RefreshDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowRefreshDialog(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<RefreshFile[]>([])
  const [screenshots, setScreenshots] = useState<ImportedScreenshot[]>([])
  const [plan, setPlan] = useState<RefreshPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const targets = useMemo(() => refreshTargets(project), [project])
  const posed = plan ? pendingChanges(plan) : []

  async function loadFiles(chosen: File[]) {
    if (chosen.length === 0) return
    setBusy(true)
    setError(null)
    try {
      /* Tout décodé avant d'enregistrer quoi que ce soit : `Promise.all` rejette
         au premier fichier illisible, donc aucun asset n'entre dans le registre
         et l'appariement précédent reste tel quel. */
      const images = await Promise.all(
        chosen.map((file) => importImageFile(file, SCREENSHOT_IMAGE_TYPES)),
      )
      const described = describeFiles(chosen.map((file) => file.name))
      setScreenshots(
        images.map((image) => ({
          assetId: registerAsset(image.dataUrl),
          size: { width: image.width, height: image.height },
        })),
      )
      setFiles(described)
      setPlan(planRefresh(targets, described))
    } catch (cause) {
      setError(imageImportErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  function confirm() {
    if (!plan) return
    const outcome = applyRefresh(plan.assignments, screenshots)
    if (!outcome.committed) {
      setError('Le lot n’a pas pu être posé : le projet est resté inchangé.')
      return
    }
    toast(
      `${outcome.value} capture${outcome.value > 1 ? 's' : ''} remplacée${outcome.value > 1 ? 's' : ''}.`,
      'success',
    )
    close()
  }

  return (
    <Dialog
      open
      onClose={close}
      title="Actualiser les captures"
      size="lg"
      flush
      headerActions={
        files.length > 0 ? (
          <span className="tabular field-label px-1">
            {files.length} fichier{files.length > 1 ? 's' : ''}
          </span>
        ) : undefined
      }
      footerNote="Le cadrage, le rôle et la mise en page sont conservés."
      footer={
        <>
          <Button variant="default" onClick={close} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" onClick={confirm} disabled={busy || posed.length === 0}>
            <RefreshCw size={12} aria-hidden />
            Remplacer {posed.length} capture{posed.length > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60dvh] flex-col overflow-y-auto px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="section-title">Appariement</h3>
            <p className="mt-1 text-2xs text-muted-foreground">
              Un fichier va sur l’écran dont il porte le rôle : <code>budget.png</code> sur les
              appareils dont le rôle est <code>budget</code>. Le reste se corrige ici.
            </p>
          </div>
          <Button variant="default" onClick={() => inputRef.current?.click()} loading={busy}>
            <ImageUp size={12} aria-hidden />
            {files.length > 0 ? 'Changer de lot…' : 'Choisir les captures…'}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SCREENSHOT_IMAGE_ACCEPT}
          aria-label="Captures à poser"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            /* La liste est copiée avant la remise à zéro du champ : une
               `FileList` est vivante, et vider `value` la vide avec lui. */
            const chosen = [...(event.target.files ?? [])]
            event.target.value = ''
            void loadFiles(chosen)
          }}
        />

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 text-2xs text-destructive">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {targets.length === 0 ? (
          <p className="text-2xs text-muted-foreground">
            Aucun appareil dans ce projet : ajoutez un cadre avant d’actualiser un lot.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {targets.map((target) => (
              <TargetRow
                key={target.layerId}
                target={target}
                files={files}
                screenshots={screenshots}
                fileIndex={
                  plan?.assignments.find((entry) => entry.layerId === target.layerId)?.fileIndex
                }
                onAssign={(fileIndex) =>
                  setPlan((current) =>
                    current
                      ? assignManually(current, targets, files, target.layerId, fileIndex)
                      : current,
                  )
                }
              />
            ))}
          </ul>
        )}

        {plan && <PlanNotes plan={plan} files={files} targets={targets} />}
      </div>
    </Dialog>
  )
}

function Thumbnail({ src, muted }: { src?: string; muted?: boolean }) {
  return src ? (
    <img
      src={src}
      alt=""
      className={cn(
        'h-12 w-6 shrink-0 rounded-xs border border-border object-cover',
        muted && 'opacity-40',
      )}
    />
  ) : (
    <span aria-hidden className="h-12 w-6 shrink-0 rounded-xs border border-dashed border-input" />
  )
}

function TargetRow({
  target,
  files,
  screenshots,
  fileIndex,
  onAssign,
}: {
  target: RefreshTarget
  files: RefreshFile[]
  screenshots: ImportedScreenshot[]
  fileIndex?: number
  onAssign: (fileIndex: number | undefined) => void
}) {
  const before = resolveAsset(target.currentAssetId)
  const after = fileIndex === undefined ? undefined : resolveAsset(screenshots[fileIndex]?.assetId)
  const place =
    target.scope === 'layout' ? target.screenName : `${target.screenRank}. ${target.screenName}`

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="truncate text-sm text-foreground">{place}</span>
        <span className="truncate text-2xs text-muted-foreground">
          {target.layerName}
          {target.slot ? ` · ${target.slot}` : ' · sans rôle'}
        </span>
      </div>
      {/* L'avant et l'après côte à côte : c'est la seule façon de vérifier qu'un
          nom de fichier désigne bien l'écran qu'on croit. */}
      <div className="flex shrink-0 items-center gap-2">
        <Thumbnail src={before} muted={after !== undefined} />
        <ArrowRight size={12} className="text-muted-foreground" aria-hidden />
        <Thumbnail src={after} />
      </div>
      <Select
        className="w-44 shrink-0"
        aria-label={`Capture pour ${target.layerName}`}
        value={fileIndex === undefined ? '' : String(fileIndex)}
        disabled={files.length === 0}
        onChange={(event) =>
          onAssign(event.target.value === '' ? undefined : Number(event.target.value))
        }
      >
        <option value="">Inchangée</option>
        {files.map((file, index) => (
          <option key={file.name + index} value={String(index)}>
            {file.name}
          </option>
        ))}
      </Select>
    </li>
  )
}

/**
 * Ce que le plan n'a pas su faire, dit avant la confirmation.
 *
 * Un lot silencieux est le pire cas : dix fichiers déposés, sept posés, et
 * l'utilisateur ne découvre les trois manquants qu'en relisant la planche
 * exportée.
 */
function PlanNotes({
  plan,
  files,
  targets,
}: {
  plan: RefreshPlan
  files: RefreshFile[]
  targets: RefreshTarget[]
}) {
  const nameOf = (layerId: string) =>
    targets.find((target) => target.layerId === layerId)?.layerName ?? layerId

  const notes = [
    ...plan.duplicateSlots.map(
      (duplicate) =>
        `Rôle « ${duplicate.slot} » réclamé par ${duplicate.fileIndexes.length} fichiers : aucun n’a été posé d’office.`,
    ),
    ...(plan.unusedFileIndexes.length > 0
      ? [
          `Fichiers sans destination : ${plan.unusedFileIndexes
            .map((index) => files[index]?.name)
            .filter(Boolean)
            .join(', ')}.`,
        ]
      : []),
    ...(plan.unmatchedLayerIds.length > 0
      ? [`Sans fichier : ${plan.unmatchedLayerIds.map(nameOf).join(', ')}.`]
      : []),
    ...(plan.slotlessLayerIds.length > 0
      ? [
          `Sans rôle, donc jamais apparié automatiquement : ${plan.slotlessLayerIds
            .map(nameOf)
            .join(', ')}.`,
        ]
      : []),
  ]

  if (notes.length === 0) return null

  return (
    <div className="mt-4 border-t border-border pt-4" aria-live="polite">
      <h3 className="section-title">À vérifier</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-2xs text-warning">
            <AlertCircle size={13} className="mt-px shrink-0" aria-hidden />
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}
