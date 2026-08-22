import { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CloudUpload,
  Copy,
  Package,
  ShieldCheck,
} from 'lucide-react'
import {
  blocking,
  bundleDigest,
  bundleFileName,
  bundleZip,
  buildManifest,
  commandLine,
  preflight,
  targetSummary,
  APP_STORE_LOCALES,
  ASC_DISPLAY_TYPE,
  ASC_SIZE_LABEL,
  EMPTY_TARGET,
  LOCALIZATION_HINT,
  ascLocaleFor,
  type AscManifestFile,
  type AscTarget,
} from '@/lib/asc'
import {
  ascBridgeStatus,
  publishSteps,
  publishViaBridge,
  setBridgeToken,
  type AscBridgeStatus,
  type BridgePublishResult,
  type BridgePublishStep,
} from '@/lib/bridge-client'
import { renderReleaseFiles, type RenderProgress } from '@/lib/release'
import { downloadBlob } from '@/lib/zip'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { StepDialog } from '@/components/patterns/step-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/patterns/select-field'
import { Switch } from '@/components/ui/switch'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project } from '@/types'

const APP_FIELD_ID = 'sf-asc-app'
const VERSION_FIELD_ID = 'sf-asc-version'
const LOCALIZATION_FIELD_ID = 'sf-asc-localization'
const TOKEN_FIELD_ID = 'sf-asc-token'

/**
 * Publier : d'abord le lot, ensuite seulement le réseau.
 *
 * La boîte impose l'ordre plutôt que de le recommander. Rien ne peut partir
 * avant que le lot ait été **rendu depuis la release figée, rehaché, comparé à
 * ses empreintes et relu par le preflight** — le bouton de publication n'existe
 * pas tant que cette préparation n'a pas abouti. C'est ce que la phase promet :
 * la publication consomme une release vérifiée, jamais le projet vivant.
 *
 * Le chemin sans pont est complet. Le ZIP et la commande à coller suffisent à
 * publier depuis un terminal, sans jeton, sans démon, sans rien installer de
 * ScreenForge. Le pont ne fait que lancer la même commande à la place de
 * l'utilisateur ; il n'est jamais le seul chemin.
 *
 * Aucun identifiant Apple n'est demandé, stocké ni affiché ici : `asc` résout
 * les siens dans le trousseau du système.
 *
 * Deux étapes : « Lot » choisit la release à publier, « Envoi » porte le
 * préflight puis l'envoi — les séparer aurait éclaté en trois clics un
 * formulaire qu'on relit d'un coup. Une release déjà figée saute directement
 * sur « Envoi » ; « Lot » ne sert qu'à en choisir une autre.
 */
export function PublishDialog() {
  const showPublishDialog = useUIStore((state) => state.showPublishDialog)
  const project = useProjectStore((state) => state.project)

  if (!showPublishDialog || !project) return null
  if (project.target !== 'app-store-iphone') return <PublishTargetRefusal />
  return <PublishDialogContent project={project} />
}

function PublishTargetRefusal() {
  const close = () => useUIStore.getState().setShowPublishDialog(false)
  return (
    <DialogShell
      open
      onClose={close}
      title="Publier chez Apple"
      footer={
        <Button variant="outline" onClick={close}>
          Fermer
        </Button>
      }
    >
      <p role="alert" className="text-sm text-destructive">
        Cette publication est réservée aux projets App Store. Exportez ce projet Google Play en ZIP
        depuis l’éditeur.
      </p>
    </DialogShell>
  )
}

interface PreparedBundle {
  releaseId: string
  bundleHash: string
  files: { name: string; blob: Blob; sha256: string }[]
  /** Les planches dont l'empreinte ne correspond plus à la release. */
  drifted: string[]
}

function PublishDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowPublishDialog(false)
  const releases = project.releases ?? []

  const [step, setStep] = useState(() => (releases.length > 0 ? 1 : 0))
  const [selectedId, setSelectedId] = useState(() => releases[releases.length - 1]?.id ?? '')
  const release = releases.find((entry) => entry.id === selectedId) ?? releases[releases.length - 1]

  const [target, setTarget] = useState<AscTarget>(() => ({
    ...EMPTY_TARGET,
    locale: ascLocaleFor(release?.locale ?? 'en') ?? 'en-US',
  }))
  const [bundle, setBundle] = useState<PreparedBundle | null>(null)
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [token, setToken] = useState('')
  const [bridge, setBridge] = useState<AscBridgeStatus | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [steps, setSteps] = useState<BridgePublishStep[]>([])
  const [publishing, setPublishing] = useState(false)

  const busy = progress !== null || publishing

  const manifestFiles = useMemo<AscManifestFile[]>(
    () =>
      (release?.files ?? []).map((file) => ({
        name: bundleFileName(file),
        sha256: file.sha256,
        byteLength: file.byteLength,
        width: file.width,
        height: file.height,
      })),
    [release],
  )

  /* Le preflight tourne au rendu : chaque frappe dans le formulaire change ce
     qui bloque, et un état dérivé aurait demandé un effet pour le suivre. */
  const findings = useMemo(
    () => (release ? preflight(release, target, manifestFiles) : []),
    [release, target, manifestFiles],
  )
  const refused = blocking(findings)

  /* Une release rendue dans une langue, poussée vers une autre fiche, part sans
     erreur et arrive fausse. Le rapprochement est fait ici, pas deviné. */
  const localeMismatch =
    release?.locale !== undefined &&
    ascLocaleFor(release.locale) !== undefined &&
    ascLocaleFor(release.locale) !== target.locale

  const usable = bundle?.releaseId === release?.id && bundle !== null && bundle.drifted.length === 0
  const drifted = bundle?.releaseId === release?.id ? (bundle?.drifted.length ?? 0) : 0

  function edit(patch: Partial<AscTarget>) {
    setTarget((previous) => ({ ...previous, ...patch }))
    setBundle(null)
    setSteps([])
  }

  /**
   * Rend le lot depuis l'instantané figé, et refuse tout ce qui a bougé.
   *
   * Les octets envoyés sont ceux dont l'empreinte vient d'être recalculée et
   * comparée à celle de la release. Une planche qui a dérivé — police disparue,
   * cadre remplacé, moteur mis à jour — arrête tout : publier un lot qui n'est
   * plus celui qui a été relu revient à ne l'avoir jamais relu.
   */
  async function prepare() {
    if (!release || busy) return
    setError(null)
    setSteps([])
    const collected: { name: string; blob: Blob; sha256: string }[] = []
    const expected = new Map(release.files.map((file) => [bundleFileName(file), file.sha256]))
    try {
      await renderReleaseFiles(release.snapshot, setProgress, (file, blob) => {
        collected.push({ name: bundleFileName(file), blob, sha256: file.sha256 })
      })
      const drift = collected
        .filter((file) => expected.get(file.name) !== file.sha256)
        .map((file) => file.name)
      const hash = await bundleDigest(collected)
      setBundle({ releaseId: release.id, bundleHash: hash, files: collected, drifted: drift })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le rendu du lot a échoué.')
    } finally {
      setProgress(null)
    }
  }

  async function download() {
    if (!bundle || !manifest) return
    const zip = await bundleZip(manifest, bundle.files)
    downloadBlob(zip, `${manifest.release.name || 'lot'}-${target.locale}.zip`)
    toast('Lot téléchargé : décompressez-le puis lancez la commande du manifeste.', 'success')
  }

  async function connect() {
    setBridge(null)
    const status = await ascBridgeStatus()
    setBridge(status)
    if (status.available) setBridgeToken('asc-publish', token)
  }

  async function publish() {
    if (!bundle || !release || !usable) return
    setPublishing(true)
    setError(null)
    setSteps([])
    try {
      const result: BridgePublishResult = await publishViaBridge(
        {
          releaseId: release.id,
          bundleHash: bundle.bundleHash,
          versionLocalization: target.versionLocalization,
          deviceType: ASC_DISPLAY_TYPE,
          files: await Promise.all(
            bundle.files.map(async (file) => ({
              name: file.name,
              base64: await base64(file.blob),
            })),
          ),
          replaceExisting,
          dryRun,
        },
        token.trim(),
      )
      setSteps(result.steps)
      toast(
        result.idempotent
          ? 'Ce lot avait déjà été publié à cette destination : rien n’a été renvoyé.'
          : result.dryRun
            ? 'Essai à blanc terminé : rien n’a été modifié chez Apple.'
            : 'Lot téléversé.',
        'success',
      )
    } catch (cause) {
      setSteps(publishSteps(cause))
      setError(cause instanceof Error ? cause.message : 'La publication a échoué.')
    } finally {
      setPublishing(false)
    }
  }

  /*
   * Une seule commande, celle du manifeste, et la page la lit au lieu d'en
   * composer une deuxième.
   *
   * Le manifeste était figé au rendu du lot, avant que les cases existent :
   * cocher « supprimer les captures déjà en ligne » laissait le bloc montrer
   * une commande sans `--replace` pendant que le pont lançait la version avec.
   * Afficher une commande à part a réparé l'écran et déplacé le défaut dans le
   * ZIP, dont le bouton est juste au-dessus. Il n'y a donc plus qu'une source :
   * le manifeste se recompose à chaque changement de case, ce qui ne coûte rien
   * — l'empreinte du lot est celle des planches, et aucune case n'y touche.
   */
  const manifest =
    release && bundle
      ? buildManifest(release, target, manifestFiles, bundle.bundleHash, {
          replaceExisting,
          dryRun,
        })
      : null
  const command = manifest?.command ?? []

  return (
    <StepDialog
      open
      onClose={busy ? () => undefined : close}
      title="Publier chez Apple"
      size="lg"
      minHeight={360}
      step={step}
      onStep={setStep}
      backDisabled={busy}
      footerNote="ScreenForge ne détient aucune clé App Store : « asc » utilise le trousseau du système."
      action={
        <Button
          variant="default"
          onClick={() => void publish()}
          loading={publishing}
          disabled={!usable || !token.trim() || refused || busy}
        >
          <CloudUpload size={12} aria-hidden />
          {dryRun ? 'Essayer à blanc' : 'Publier'}
        </Button>
      }
      steps={[
        {
          id: 'lot',
          title: 'Lot',
          content:
            releases.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun lot figé. Ouvrez « Releases » pour en figer un : on ne publie que ce qui a été
                rendu et haché.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1">
                  {[...releases].reverse().map((entry) => (
                    <li key={entry.id}>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedId(entry.id)
                          setBundle(null)
                          setSteps([])
                          setStep(1)
                        }}
                        aria-current={entry.id === release?.id}
                        className={cn(
                          'h-auto w-full flex-col items-start justify-start gap-0.5 whitespace-normal rounded-md border px-3 py-2 text-start font-normal',
                          entry.id === release?.id
                            ? 'border-foreground bg-muted'
                            : 'border-border hover:border-input',
                        )}
                      >
                        <span className="truncate text-sm text-foreground">{entry.name}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {entry.files.length} planches · {entry.locale ?? 'langue du projet'}
                          {entry.watermarked ? ' · filigrane' : ''}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{ASC_SIZE_LABEL}</p>
              </div>
            ),
        },
        {
          id: 'envoi',
          title: 'Envoi',
          content: (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={APP_FIELD_ID}>Identifiant de l’application</FieldLabel>
                  <Input
                    id={APP_FIELD_ID}
                    placeholder="com.exemple.monapp"
                    value={target.bundleId}
                    disabled={busy}
                    onChange={(event) => edit({ bundleId: event.target.value.trim() })}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={VERSION_FIELD_ID}>Version</FieldLabel>
                  <Input
                    id={VERSION_FIELD_ID}
                    placeholder="1.4.0"
                    value={target.appVersion}
                    disabled={busy}
                    onChange={(event) => edit({ appVersion: event.target.value.trim() })}
                  />
                </Field>
                <SelectField
                  aria-label="Langue App Store"
                  label="Langue App Store"
                  value={target.locale}
                  disabled={busy}
                  onValueChange={(locale) => edit({ locale })}
                  items={APP_STORE_LOCALES.map((locale) => ({ value: locale, label: locale }))}
                />
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={LOCALIZATION_FIELD_ID}>
                    Identifiant de localisation de version
                  </FieldLabel>
                  <Input
                    id={LOCALIZATION_FIELD_ID}
                    placeholder="0a1b2c3d-…"
                    value={target.versionLocalization}
                    disabled={busy}
                    onChange={(event) => edit({ versionLocalization: event.target.value.trim() })}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Il se lit avec{' '}
                  <code className="text-foreground">{commandLine(LOCALIZATION_HINT)}</code>.
                </p>
              </div>

              {localeMismatch && (
                <p role="alert" className="text-xs text-warning">
                  Ce lot a été rendu en « {release?.locale} » mais viserait la fiche «{' '}
                  {target.locale} ».
                </p>
              )}

              {release && findings.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Résultat du preflight">
                  {findings.map((finding) => (
                    <li
                      key={finding.message}
                      {...(finding.level === 'error' ? { role: 'alert' } : {})}
                      className={cn(
                        'flex items-start gap-2 text-xs',
                        finding.level === 'error' ? 'text-destructive' : 'text-warning',
                      )}
                    >
                      <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden />
                      {finding.message}
                    </li>
                  ))}
                </ul>
              )}

              {/* Trois états, jamais deux : sans release le preflight n'a rien lu, et
                  une liste vide ne vaut pas un feu vert. La coche ne s'affiche que sur
                  un lot réellement passé par `preflight()`. */}
              {!release && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Package size={12} className="mt-0.5 shrink-0" aria-hidden />
                  Figez d’abord une release dans « Releases » : le preflight porte sur un lot rendu.
                </p>
              )}

              {release && findings.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-success">
                  <ShieldCheck size={12} aria-hidden />
                  Preflight sans réserve : {targetSummary(target)}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void prepare()}
                  loading={progress !== null}
                  disabled={!release || refused || busy}
                >
                  <Package size={12} aria-hidden />
                  Préparer le lot
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void download()}
                  disabled={!usable || busy}
                >
                  Télécharger le lot
                </Button>
              </div>

              {progress && (
                <p role="status" className="tabular-nums text-xs text-muted-foreground">
                  {progress.current}/{progress.total} · {progress.label}
                </p>
              )}

              {drifted > 0 && (
                <Alert variant="warning">
                  <AlertTriangle aria-hidden />
                  <AlertTitle>Le lot a changé depuis son gel</AlertTitle>
                  <AlertDescription>
                    {drifted} planche{drifted > 1 ? 's' : ''} ne correspond
                    {drifted > 1 ? 'ent' : ''} plus à la release gelée. Gelez un nouveau lot pour
                    publier ce qui est sur la planche.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}

              {usable && bundle && (
                <div className="rounded-xl border bg-muted flex flex-col gap-2 p-4">
                  <span className="text-xs text-muted-foreground">Commande à lancer</span>
                  <code className="block break-all text-xs text-foreground">
                    {commandLine(command)}
                  </code>
                  <p className="tabular-nums text-xs text-muted-foreground">
                    Empreinte du lot : {bundle.bundleHash.slice(0, 16)}…
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard?.writeText(commandLine(command))
                      toast('Commande copiée.', 'success')
                    }}
                  >
                    <Copy size={12} aria-hidden />
                    Copier
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Publier via le pont local</span>
                <p className="text-xs text-muted-foreground">
                  Facultatif : le pont lance la même commande à votre place. Son jeton « asc-publish
                  » est distinct de celui de l’assistance, et ne quitte pas cet onglet.
                </p>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={TOKEN_FIELD_ID}>Jeton asc-publish</FieldLabel>
                  <Input
                    id={TOKEN_FIELD_ID}
                    type="password"
                    autoComplete="off"
                    value={token}
                    disabled={busy}
                    onChange={(event) => setToken(event.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => void connect()} disabled={busy}>
                    Vérifier le pont
                  </Button>
                </div>

                <label className="flex items-center justify-between gap-3 text-xs text-foreground">
                  Essai à blanc (rien n’est modifié chez Apple)
                  <Switch
                    checked={dryRun}
                    onCheckedChange={setDryRun}
                    aria-label="Essai à blanc"
                    disabled={busy}
                  />
                </label>
                {/* Le seul drapeau destructeur de la boîte : décoché par défaut, et
                    dit en toutes lettres ce qu'il supprime. */}
                <label className="flex items-center justify-between gap-3 text-xs text-foreground">
                  Supprimer les captures déjà en ligne avant d’envoyer
                  <Switch
                    checked={replaceExisting}
                    onCheckedChange={setReplaceExisting}
                    aria-label="Remplacer les captures existantes"
                    disabled={busy}
                  />
                </label>

                {bridge && (
                  <p
                    role="status"
                    className={cn(
                      'text-xs',
                      bridge.available ? 'text-muted-foreground' : 'text-destructive',
                    )}
                  >
                    {bridge.available
                      ? `Pont prêt · asc ${bridge.version ?? '?'}${bridge.flags.length ? ` · ${bridge.flags.join(' ')}` : ''}`
                      : (bridge.message ?? 'Pont indisponible.')}
                  </p>
                )}

                {steps.length > 0 && (
                  <ul className="flex flex-col gap-1" aria-label="Étapes de la publication">
                    {steps.map((publishStep) => (
                      <li
                        key={publishStep.name}
                        className={cn(
                          'tabular-nums flex items-center gap-2 text-xs',
                          publishStep.status === 'ok'
                            ? 'text-muted-foreground'
                            : 'text-destructive',
                        )}
                      >
                        {publishStep.status === 'ok' ? (
                          <Check size={12} aria-hidden />
                        ) : (
                          <AlertCircle size={12} aria-hidden />
                        )}
                        {publishStep.name} · {publishStep.detail} · {publishStep.ms} ms
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}

/** Les octets en base64, sans passer par une chaîne binaire de 3 Mo. */
async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
  }
  return btoa(binary)
}
