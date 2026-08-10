import { useMemo, useState } from 'react'
import { AlertCircle, Check, History, Loader, Package, ShieldCheck, Trash2 } from 'lucide-react'
import {
  addRelease,
  countChanges,
  diffSnapshots,
  freezeRelease,
  removeRelease,
  renderReleaseFiles,
  snapshotOf,
  verifyRelease,
  type LayerChange,
  type ReleaseCheck,
  type RenderProgress,
  type StructuralDiff,
} from '@/lib/release'
import { MAX_PROJECT_RELEASES, MAX_RELEASE_NAME_LENGTH } from '@/lib/project-validation'
import { saveCurrentProject } from '@/lib/storage'
import { rightsOf } from '@/lib/entitlements'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project, Release } from '@/types'

const RELEASE_NAME_FIELD_ID = 'sf-release-name'

/**
 * Les lots livrés, et ce qui a bougé depuis.
 *
 * Une campagne ne se juge pas planche par planche mais d'une release à
 * l'autre : ce qui a changé, ce qui n'aurait pas dû, ce qui doit repartir. La
 * boîte fige un lot (rendu complet, empreintes, instantané cloné), le vérifie
 * en le rejouant, et affiche le diff structurel entre l'instantané et le projet
 * d'aujourd'hui.
 */
export function ReleaseDialog() {
  const showReleaseDialog = useUIStore((state) => state.showReleaseDialog)
  const project = useProjectStore((state) => state.project)

  if (!showReleaseDialog || !project) return null
  return <ReleaseDialogContent project={project} />
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReleaseDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowReleaseDialog(false)
  const releases = project.releases ?? []
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => releases[releases.length - 1]?.id,
  )
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<{ releaseId: string; results: ReleaseCheck[] } | null>(null)
  const watermarked = !rightsOf(useAuthStore((state) => state.entitlements)).cleanExport

  const selected =
    releases.find((release) => release.id === selectedId) ?? releases[releases.length - 1]
  const busy = progress !== null

  /* Recalculé au rendu : le diff est une lecture de deux valeurs immuables,
     et un état dérivé aurait demandé un effet pour suivre le projet. */
  const diff = useMemo<StructuralDiff | null>(
    () => (selected ? diffSnapshots(selected.snapshot, snapshotOf(project)) : null),
    [selected, project],
  )

  async function freeze() {
    if (busy) return
    setError(null)
    setChecks(null)
    const snapshot = snapshotOf(project)
    try {
      const files = await renderReleaseFiles(snapshot, watermarked, setProgress)
      const release = freezeRelease(
        crypto.randomUUID(),
        name.trim() || `Lot du ${formatDate(Date.now())}`,
        snapshot,
        files,
        watermarked,
        Date.now(),
      )
      const outcome = addRelease(release)
      if (!outcome.committed) {
        setError(`Maximum de ${MAX_PROJECT_RELEASES} releases atteint pour ce projet.`)
        return
      }
      setSelectedId(release.id)
      setName('')
      /* Durable avant d'être annoncé. L'autosave attend deux secondes ; un
         rechargement dans cet intervalle effacerait un rendu que l'utilisateur
         vient d'attendre, et une release perdue n'est pas une modification
         perdue — c'est le fait daté sur lequel tout le reste s'appuie. */
      await saveCurrentProject()
      toast(
        `Release « ${release.name} » figée : ${files.length} planche${files.length > 1 ? 's' : ''}.`,
        'success',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le rendu du lot a échoué.')
    } finally {
      setProgress(null)
    }
  }

  async function verify(release: Release) {
    if (busy) return
    setError(null)
    setChecks(null)
    try {
      const results = await verifyRelease(release, setProgress)
      setChecks({ releaseId: release.id, results })
    } finally {
      setProgress(null)
    }
  }

  function forget(release: Release) {
    if (busy) return
    if (!removeRelease(release.id).committed) return
    setChecks(null)
    setSelectedId(undefined)
    toast(`Release « ${release.name} » retirée.`, 'success')
  }

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : close}
      title="Releases"
      size="lg"
      flush
      headerActions={
        <span className="tabular field-label px-1">
          {releases.length}/{MAX_PROJECT_RELEASES}
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-2xs text-muted-foreground">
            Une release fige l’état rendu ; le projet continue de vivre à côté.
          </p>
          <Button variant="default" onClick={close} disabled={busy}>
            Fermer
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <aside
          className="flex max-h-[56dvh] flex-col gap-3 overflow-y-auto border-r border-border px-4 py-4"
          aria-label="Lots figés"
        >
          <div className="flex flex-col gap-1.5">
            <Field id={RELEASE_NAME_FIELD_ID} label="Nom du lot">
              <Input
                id={RELEASE_NAME_FIELD_ID}
                font="sans"
                value={name}
                maxLength={MAX_RELEASE_NAME_LENGTH}
                placeholder="1.4.0"
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              onClick={() => void freeze()}
              loading={busy && !checks}
              disabled={busy || releases.length >= MAX_PROJECT_RELEASES}
            >
              <Package size={12} aria-hidden />
              Figer une release
            </Button>
          </div>

          {releases.length === 0 ? (
            <p className="text-2xs text-muted-foreground">
              Aucun lot figé. Le premier servira de référence à tous les suivants.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {[...releases].reverse().map((release) => (
                <li key={release.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(release.id)}
                    aria-current={release.id === selected?.id}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                      release.id === selected?.id
                        ? 'border-foreground bg-muted'
                        : 'border-border hover:border-input',
                    )}
                  >
                    <span className="truncate text-sm text-foreground">{release.name}</span>
                    <span className="tabular text-2xs text-muted-foreground">
                      {formatDate(release.createdAt)} · {release.files.length} planches
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="max-h-[56dvh] overflow-y-auto px-6 py-4" aria-label="Détail du lot">
          {progress && (
            <div className="mb-4" aria-live="polite">
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
                  style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-4 flex items-start gap-2 text-2xs text-destructive">
              <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {!selected ? (
            <p className="text-2xs text-muted-foreground">
              Figez un lot pour pouvoir comparer les livraisons suivantes à celui-ci.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="section-title">{selected.name}</h3>
                  <p className="tabular mt-1 text-2xs text-muted-foreground">
                    {formatDate(selected.createdAt)} · {selected.files.length} planches
                    {selected.watermarked ? ' · filigrané' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="default" onClick={() => void verify(selected)} disabled={busy}>
                    <ShieldCheck size={12} aria-hidden />
                    Vérifier
                  </Button>
                  <Button variant="default" onClick={() => forget(selected)} disabled={busy}>
                    <Trash2 size={12} aria-hidden />
                    Retirer
                  </Button>
                </div>
              </div>

              {checks && checks.releaseId === selected.id && (
                <VerifyReport results={checks.results} />
              )}
              {diff && <DiffReport diff={diff} />}
            </div>
          )}
        </section>
      </div>
    </Dialog>
  )
}

/**
 * Ce que la vérification a trouvé.
 *
 * Une release qui se rejoue à l'identique n'a rien à raconter — une ligne
 * suffit. Ce qui mérite d'être lu est ce qui a changé, donc seules ces
 * planches-là sont listées.
 */
function VerifyReport({ results }: { results: ReleaseCheck[] }) {
  const broken = results.filter((result) => result.status !== 'ok')

  return (
    <div className="border-t border-border pt-4" aria-live="polite">
      <h3 className="section-title">Vérification</h3>
      {broken.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-2xs text-foreground">
          <Check size={13} className="text-success" aria-hidden />
          Les {results.length} planches se rejouent à l’identique.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {broken.map((result) => (
            <li key={result.path} className="flex items-start gap-2 text-2xs text-warning">
              <AlertCircle size={13} className="mt-px shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="tabular">{result.path}</span>
                {' — '}
                {result.status === 'changed' ? 'empreinte différente' : 'rendu impossible'}
                {result.detail ? ` (${result.detail})` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Le vocabulaire du modèle, dit en français quand il en existe un. */
const PROP_LABELS: Record<string, string> = {
  x: 'position X',
  y: 'position Y',
  width: 'largeur',
  height: 'hauteur',
  rotation: 'rotation',
  opacity: 'opacité',
  visible: 'visibilité',
  locked: 'verrouillage',
  zIndex: 'ordre',
  name: 'nom',
  content: 'texte',
  textAlign: 'alignement',
  fontFamily: 'police',
  fontSize: 'corps',
  fontWeight: 'graisse',
  color: 'couleur',
  fill: 'remplissage',
  screenshotAssetId: 'capture',
  screenshotSize: 'taille de capture',
  placement: 'cadrage',
  slot: 'rôle',
  deviceModel: 'modèle',
  deviceColor: 'teinte',
  assetId: 'image',
  iconId: 'icône',
  shapeType: 'forme',
}

function propLabel(prop: string): string {
  return PROP_LABELS[prop] ?? prop
}

function LayerLine({ change }: { change: LayerChange }) {
  const verb = change.kind === 'added' ? 'ajouté' : change.kind === 'removed' ? 'retiré' : 'modifié'
  return (
    <li className="flex items-baseline gap-2 text-2xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 translate-y-px rounded-full',
          change.kind === 'removed' ? 'bg-destructive' : 'bg-marker',
        )}
      />
      <span className="min-w-0">
        <span className="text-foreground">{change.name}</span> {verb}
        {change.props.length > 0 ? ` : ${change.props.map(propLabel).join(', ')}` : ''}
      </span>
    </li>
  )
}

function DiffReport({ diff }: { diff: StructuralDiff }) {
  const total = countChanges(diff)

  return (
    <div className="border-t border-border pt-4">
      <h3 className="section-title">Depuis cette release</h3>
      {diff.identical ? (
        <p className="mt-2 flex items-center gap-2 text-2xs text-foreground">
          <History size={13} aria-hidden />
          Le projet est exactement dans l’état figé.
        </p>
      ) : (
        <>
          <p className="mt-1 text-2xs text-muted-foreground">
            {total} changement{total > 1 ? 's' : ''} structurel{total > 1 ? 's' : ''}.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {diff.projectRenamed && (
              <p className="text-2xs text-muted-foreground">
                Projet renommé : {diff.projectRenamed.from} → {diff.projectRenamed.to}
              </p>
            )}
            {diff.screens.map((screen) => (
              <div key={screen.screenId}>
                <p className="text-sm text-foreground">
                  {screen.name}
                  {screen.added && ' — ajouté'}
                  {screen.removed && ' — retiré'}
                  {screen.renamedFrom && ` — renommé depuis « ${screen.renamedFrom} »`}
                  {screen.backgroundChanged && ' — fond modifié'}
                </p>
                {screen.layers.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {screen.layers.map((change) => (
                      <LayerLine key={change.layerId} change={change} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {diff.layoutLayers.length > 0 && (
              <div>
                <p className="text-sm text-foreground">Calques partagés</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {diff.layoutLayers.map((change) => (
                    <LayerLine key={change.layerId} change={change} />
                  ))}
                </ul>
              </div>
            )}
            {diff.globals.length > 0 && (
              <p className="text-2xs text-muted-foreground">
                Réglages globaux : {diff.globals.map(propLabel).join(', ')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
