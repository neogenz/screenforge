import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  CloudUpload,
  Copy,
  Package,
  Plug,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { AscApp, AscLocalization, AscVersion } from 'bridge'
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
  EMPTY_TARGET,
  LOCALIZATION_HINT,
  ascDeviceType,
  ascLocaleFor,
  ascSizeLabel,
  type AscManifestFile,
  type AscTarget,
} from '@/lib/asc'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { BRIDGE_COMMAND } from '@/lib/ai/providers'
import {
  ascBridgeStatus,
  listAscApps,
  listAscLocalizations,
  listAscVersions,
  publishSteps,
  publishUnauthorized,
  publishViaBridge,
  type AscBridgeStatus,
  type BridgePublishResult,
  type BridgePublishStep,
} from '@/lib/bridge-client'
import { renderReleaseFiles, type RenderProgress } from '@/lib/release'
import { downloadBlob } from '@/lib/zip'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AsyncPanel } from '@/components/patterns/async-panel'
import { ConfirmAction } from '@/components/patterns/confirm-action'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { StepDialog } from '@/components/patterns/step-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/patterns/select-field'
import {
  SetupCommand,
  SetupFlow,
  SetupProgress,
  SetupStep,
  type SetupStepState,
} from '@/components/patterns/setup-flow'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project, Release } from '@/types'

const TOKEN_FIELD_ID = 'sf-asc-token'
const APP_FIELD_ID = 'sf-asc-app'
const VERSION_FIELD_ID = 'sf-asc-version'
const LOCALIZATION_FIELD_ID = 'sf-asc-localization'
const APP_PICK_ID = 'sf-asc-app-pick'
const VERSION_PICK_ID = 'sf-asc-version-pick'
const LOCALIZATION_PICK_ID = 'sf-asc-localization-pick'
const RELEASE_PICK_ID = 'sf-asc-release-pick'

/** Un chargement lu chez Apple : jamais un booléen isolé, jamais un spinner brut. */
type Loadable<T> =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'ready'; data: T }
  | { state: 'failed'; message: string }

function failureMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'La lecture chez Apple a échoué.'
}

/**
 * Ce qu'Apple fera d'un lot envoyé sur une version dans cet état — `null`
 * quand il l'accepte.
 *
 * Deux phrases parce que deux situations : une version distribuée ne se
 * rouvre jamais, une version soumise se retire de la revue. Ni exhaustive ni
 * maintenue depuis un catalogue : `asc` refuserait lui-même un état qu'il ne
 * connaît pas. Mesuré sur un compte réel : toutes les versions étaient
 * distribuées, la boîte en retenait une sans un mot, et Apple aurait refusé le
 * lot à l'envoi — d'où l'alerte, à l'étape qui choisit et à celle qui envoie.
 */
const RELEASED_VERSION_STATES = new Set([
  'READY_FOR_SALE',
  'READY_FOR_DISTRIBUTION',
  'REPLACED_WITH_NEW_VERSION',
  'REMOVED_FROM_SALE',
  'DEVELOPER_REMOVED_FROM_SALE',
])
const SUBMITTED_VERSION_STATES = new Set([
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'ACCEPTED',
  'PENDING_DEVELOPER_RELEASE',
  'PENDING_APPLE_RELEASE',
  'PROCESSING_FOR_DISTRIBUTION',
  'PROCESSING_FOR_APP_STORE',
])

function versionLock(state: string): string | null {
  if (RELEASED_VERSION_STATES.has(state))
    return 'Cette version est déjà distribuée : Apple n’y accepte plus de captures. Créez d’abord une nouvelle version dans App Store Connect.'
  if (SUBMITTED_VERSION_STATES.has(state))
    return 'Cette version est déjà soumise à Apple : ses captures sont verrouillées. Retirez-la de la revue, ou créez une nouvelle version dans App Store Connect.'
  return null
}

/** La première version qu'Apple accepterait, sinon la première tout court. */
function defaultVersion(versions: readonly AscVersion[]): AscVersion | undefined {
  return versions.find((version) => versionLock(version.state) === null) ?? versions[0]
}

function appsCountLabel(count: number): string {
  return `${count} application${count > 1 ? 's' : ''} lue${count > 1 ? 's' : ''} chez Apple`
}

/**
 * La langue à proposer avant toute lecture chez Apple.
 *
 * `release.locale` est absent pour la langue d'origine du projet — jamais pour
 * une langue inconnue. Le repli suit donc le projet, puis le français : c'est
 * la langue par défaut de tout ScreenForge, la même que le pont assume déjà
 * quand un brief ne précise rien.
 */
function guessAscLocale(release: Release, project: Project): string {
  const source = release.locale ?? project.listing?.language ?? 'fr-FR'
  return ascLocaleFor(source) ?? 'fr-FR'
}

const DIALOG_TITLE = 'Publier sur App Store Connect'
const DIALOG_DESCRIPTION =
  'Le lot figé est vérifié (preflight), empaqueté avec son manifeste, puis remis au pont qui appelle « asc » sur votre Mac. ScreenForge ne détient aucun identifiant Apple.'

/**
 * Publier : d'abord le lot, ensuite seulement le réseau.
 *
 * Trois étapes, dans l'ordre où elles deviennent possibles. « Pont » constate
 * que « asc » tourne et appairé un jeton — rien ici ne peut échouer que par un
 * pont éteint ou un jeton refusé. « Destination » lit l'application, la
 * version et la localisation chez Apple au lieu de les faire recopier depuis
 * un terminal ; le chemin sans pont reste entier, replié dans « Saisir les
 * identifiants à la main ». « Envoi » ne change pas : preflight, rendu,
 * empreinte, essai à blanc ou publication confirmée.
 *
 * Rien ne peut partir avant que le lot ait été **rendu depuis la version
 * figée, rehaché et relu par le preflight** — le bouton de publication
 * n'existe pas tant que cette préparation n'a pas abouti.
 *
 * Aucun identifiant Apple n'est demandé, stocké ni affiché ici : `asc` résout
 * les siens dans le trousseau du système.
 */
export function PublishDialog() {
  const showPublishDialog = useUIStore((state) => state.showPublishDialog)
  const project = useProjectStore((state) => state.project)
  // Le lot choisi : la dernière version figée tant qu'on n'en désigne pas une autre.
  const [pickedId, setPickedId] = useState<string | null>(null)

  if (!showPublishDialog || !project) return null
  if (getStoreTargetProfile(project.target).platform !== 'apple') return <PublishTargetRefusal />
  const publishReleases = project.releases ?? []
  const release =
    publishReleases.find((entry) => entry.id === pickedId) ??
    publishReleases[publishReleases.length - 1]
  if (!release) return <PublishNoReleases />
  return (
    <PublishDialogContent
      project={project}
      release={release}
      releases={publishReleases}
      onPickRelease={setPickedId}
    />
  )
}

function PublishTargetRefusal() {
  const close = () => useUIStore.getState().setShowPublishDialog(false)
  return (
    <DialogShell
      open
      onClose={close}
      title={DIALOG_TITLE}
      footer={
        <Button variant="ghost" onClick={close}>
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

function PublishNoReleases() {
  const close = () => useUIStore.getState().setShowPublishDialog(false)
  return (
    <DialogShell
      open
      onClose={close}
      title={DIALOG_TITLE}
      footer={
        <Button variant="ghost" onClick={close}>
          Fermer
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Aucune version figée. Ouvrez « Versions figées » pour en figer une : c’est ce lot, et lui
        seul, qui part chez Apple.
      </p>
    </DialogShell>
  )
}

interface PreparedBundle {
  releaseId: string
  bundleHash: string
  files: { name: string; blob: Blob; sha256: string }[]
  /** Les planches dont l'empreinte ne correspond plus à la version figée. */
  drifted: string[]
}

function PublishDialogContent({
  project,
  release,
  releases,
  onPickRelease,
}: {
  project: Project
  release: Release
  releases: Release[]
  onPickRelease: (id: string) => void
}) {
  const close = () => useUIStore.getState().setShowPublishDialog(false)

  const [step, setStep] = useState(0)

  const [bridge, setBridge] = useState<AscBridgeStatus | null>(null)
  const [token, setToken] = useState('')
  const [appsResult, setAppsResult] = useState<Loadable<AscApp[]>>({ state: 'idle' })
  const [versionsResult, setVersionsResult] = useState<Loadable<AscVersion[]>>({ state: 'idle' })
  const [localizationsResult, setLocalizationsResult] = useState<Loadable<AscLocalization[]>>({
    state: 'idle',
  })

  const [target, setTarget] = useState<AscTarget>(() => ({
    ...EMPTY_TARGET,
    locale: guessAscLocale(release, project),
  }))
  const [preparedBundle, setBundle] = useState<PreparedBundle | null>(null)
  // Préparé pour un autre lot, il ne vaut rien pour celui-ci : changer de version le rend nul.
  const bundle = preparedBundle?.releaseId === release.id ? preparedBundle : null
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [replaceExisting, setReplaceExisting] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [steps, setSteps] = useState<BridgePublishStep[]>([])
  const [publishing, setPublishing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const busy = progress !== null || publishing || downloading

  /* Constaté à l'ouverture, sans jeton : `hello` répond que le pont tourne (ou
     non) avant que quiconque n'ait rien collé. Aucun `setState` synchrone ici
     — seulement dans la résolution — pour ne jamais empiler un rendu sur un
     autre. */
  useEffect(() => {
    let cancelled = false
    void ascBridgeStatus().then((status) => {
      if (!cancelled) setBridge(status)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function recheckBridge() {
    setBridge(null)
    void ascBridgeStatus().then(setBridge)
  }

  const bridgeReady = bridge !== null && bridge.reachable && bridge.available
  const bridgeStepState: SetupStepState = bridgeReady ? 'done' : bridge ? 'error' : 'active'
  const tokenStepState: SetupStepState =
    appsResult.state === 'ready'
      ? 'done'
      : !bridgeReady
        ? 'waiting'
        : appsResult.state === 'failed'
          ? 'error'
          : 'active'
  const targetReady = Boolean(
    target.bundleId && target.appVersion && target.locale && target.versionLocalization,
  )
  const destinationStepState: SetupStepState = targetReady
    ? 'done'
    : appsResult.state === 'ready'
      ? 'active'
      : 'waiting'
  const pontProgress =
    (bridgeReady ? 1 : 0) + (appsResult.state === 'ready' ? 1 : 0) + (targetReady ? 1 : 0)

  function edit(patch: Partial<AscTarget>) {
    setTarget((previous) => ({ ...previous, ...patch }))
    setBundle(null)
    setSteps([])
  }

  async function verifyToken() {
    const trimmed = token.trim()
    if (!trimmed || !bridgeReady) return
    setAppsResult({ state: 'pending' })
    try {
      const apps = await listAscApps(trimmed)
      setAppsResult({ state: 'ready', data: apps })
      // Seulement sans destination : revérifier un jeton après un 401 passe
      // par ici, et `selectApp` → `edit` jetterait le lot déjà préparé.
      if (apps[0] && !apps.some((app) => app.id === target.appId)) void selectApp(apps[0])
    } catch (cause) {
      setAppsResult({ state: 'failed', message: failureMessage(cause) })
    }
  }

  async function selectApp(app: AscApp) {
    edit({
      appId: app.id,
      appName: app.name,
      bundleId: app.bundleId,
      versionId: undefined,
      versionLocalization: '',
    })
    setVersionsResult({ state: 'pending' })
    setLocalizationsResult({ state: 'idle' })
    try {
      const versions = await listAscVersions(app.id, token.trim())
      setVersionsResult({ state: 'ready', data: versions })
      const pick = defaultVersion(versions)
      if (pick) void selectVersion(pick)
    } catch (cause) {
      setVersionsResult({ state: 'failed', message: failureMessage(cause) })
    }
  }

  async function selectVersion(version: AscVersion) {
    edit({ versionId: version.id, appVersion: version.versionString, versionLocalization: '' })
    setLocalizationsResult({ state: 'pending' })
    try {
      const localizations = await listAscLocalizations(version.id, token.trim())
      setLocalizationsResult({ state: 'ready', data: localizations })
      const wanted = guessAscLocale(release, project)
      const found = localizations.find((entry) => entry.locale === wanted)
      if (found) edit({ locale: found.locale, versionLocalization: found.id })
    } catch (cause) {
      setLocalizationsResult({ state: 'failed', message: failureMessage(cause) })
    }
  }

  const selectedApp =
    appsResult.state === 'ready'
      ? appsResult.data.find((app) => app.id === target.appId)
      : undefined
  const selectedVersion =
    versionsResult.state === 'ready'
      ? versionsResult.data.find((version) => version.id === target.versionId)
      : undefined
  const pickedVersionLock = selectedVersion ? versionLock(selectedVersion.state) : null
  const matchedLocalization =
    localizationsResult.state === 'ready' && target.versionLocalization
      ? localizationsResult.data.find((entry) => entry.id === target.versionLocalization)
      : undefined

  const manifestFiles = useMemo<AscManifestFile[]>(
    () =>
      release.files.map((file) => ({
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
    () => preflight(release, target, manifestFiles),
    [release, target, manifestFiles],
  )
  const refused = blocking(findings)

  /* Une version rendue dans une langue, poussée vers une autre fiche, part sans
     erreur et arrive fausse. Le rapprochement est fait ici, pas deviné. */
  const localeMismatch =
    release.locale !== undefined &&
    ascLocaleFor(release.locale) !== undefined &&
    ascLocaleFor(release.locale) !== target.locale

  const usable = bundle !== null && bundle.drifted.length === 0
  const drifted = bundle?.drifted.length ?? 0

  /**
   * Rend le lot depuis l'instantané figé, et refuse tout ce qui a bougé.
   *
   * Les octets envoyés sont ceux dont l'empreinte vient d'être recalculée et
   * comparée à celle de la version figée. Une planche qui a dérivé — police
   * disparue, cadre remplacé, moteur mis à jour — arrête tout : publier un lot
   * qui n'est plus celui qui a été relu revient à ne l'avoir jamais relu.
   */
  async function prepare() {
    if (busy) return
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
    if (!bundle || !manifest || busy) return
    setDownloading(true)
    setError(null)
    try {
      const zip = await bundleZip(manifest, bundle.files)
      downloadBlob(zip, `${manifest.release.name || 'lot'}-${target.locale}.zip`)
      toast('Lot téléchargé : décompressez-le puis lancez la commande du manifeste.', 'success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le téléchargement a échoué.')
    } finally {
      setDownloading(false)
    }
  }

  async function publish() {
    if (!bundle || !usable) return
    setPublishing(true)
    setError(null)
    setSteps([])
    try {
      const result: BridgePublishResult = await publishViaBridge(
        {
          releaseId: release.id,
          bundleHash: bundle.bundleHash,
          versionLocalization: target.versionLocalization,
          deviceType: ascDeviceType(release),
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
      // Un jeton refusé rouvre l'étape « Pont » : `SetupStep` remplace son champ
      // par le résultat dès qu'il est « done », donc fermer la boîte était la
      // seule sortie — celle-ci jette le lot déjà préparé.
      if (publishUnauthorized(cause)) setAppsResult({ state: 'idle' })
    } finally {
      setPublishing(false)
    }
  }

  /*
   * Une seule commande, celle du manifeste, et la page la lit au lieu d'en
   * composer une deuxième. Le manifeste se recompose à chaque changement de
   * case, ce qui ne coûte rien : l'empreinte du lot est celle des planches, et
   * aucune case n'y touche.
   */
  const manifest = bundle
    ? buildManifest(release, target, manifestFiles, bundle.bundleHash, { replaceExisting, dryRun })
    : null
  const command = manifest?.command ?? []

  const confirmDescription = bundle
    ? `Envoie ${bundle.files.length} planche${bundle.files.length > 1 ? 's' : ''} vers « ${
        target.appName || target.bundleId
      } » ${target.appVersion} (${target.locale})${
        replaceExisting ? ', en remplaçant les captures déjà en ligne' : ''
      }.`
    : ''

  return (
    <>
      <StepDialog
        open
        onClose={busy ? () => undefined : close}
        title={DIALOG_TITLE}
        description={DIALOG_DESCRIPTION}
        size="lg"
        minHeight={400}
        step={step}
        onStep={setStep}
        backDisabled={busy}
        action={
          step < 2 ? (
            <Button variant="default" onClick={() => setStep(step + 1)} disabled={busy}>
              Continuer
              <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={() => (dryRun ? void publish() : setConfirmOpen(true))}
              loading={publishing}
              disabled={!usable || !token.trim() || refused || busy}
            >
              <CloudUpload aria-hidden />
              {dryRun ? 'Essayer à blanc' : 'Publier'}
            </Button>
          )
        }
        steps={[
          {
            id: 'pont',
            title: 'Pont',
            content: (
              <SetupFlow>
                <div className="flex flex-col gap-3 p-3">
                  <SetupProgress label="Connexion au pont" value={pontProgress} max={3} />

                  <SetupStep
                    rank={1}
                    title="Le pont tourne, avec « asc » connecté"
                    state={bridgeStepState}
                    result={`asc ${bridge?.version ?? '?'}`}
                  >
                    <p className="text-xs text-muted-foreground">
                      Dans un terminal, depuis le dossier où vous avez cloné ScreenForge :
                    </p>
                    <SetupCommand command={BRIDGE_COMMAND} />
                    <p
                      role={bridge ? 'alert' : 'status'}
                      className={cn(
                        'flex items-start gap-1.5 text-xs',
                        bridge ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {bridge && <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                      {bridge ? (bridge.message ?? 'Pont indisponible.') : 'Recherche du pont…'}
                    </p>
                    {bridge?.reachable && !bridge.available && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Puis, dans le même terminal :
                        </p>
                        <SetupCommand command="asc auth login" />
                      </>
                    )}
                    <div>
                      <Button
                        variant="outline"
                        onClick={recheckBridge}
                        loading={bridge === null}
                        disabled={busy}
                      >
                        <RefreshCw aria-hidden />
                        Vérifier
                      </Button>
                    </div>
                  </SetupStep>

                  <SetupStep
                    rank={2}
                    title="Collez le jeton « asc-publish » affiché par le pont"
                    state={tokenStepState}
                    result={
                      appsResult.state === 'ready'
                        ? appsCountLabel(appsResult.data.length)
                        : undefined
                    }
                  >
                    <div className="flex items-end gap-2">
                      <Field className="min-w-0 flex-1 gap-1.5">
                        <FieldLabel htmlFor={TOKEN_FIELD_ID}>Jeton asc-publish</FieldLabel>
                        <Input
                          id={TOKEN_FIELD_ID}
                          type="password"
                          autoComplete="off"
                          value={token}
                          disabled={busy || !bridgeReady}
                          onChange={(event) => setToken(event.target.value)}
                        />
                      </Field>
                      <Button
                        variant="outline"
                        onClick={() => void verifyToken()}
                        loading={appsResult.state === 'pending'}
                        disabled={busy || !bridgeReady || token.trim().length === 0}
                      >
                        <Plug aria-hidden />
                        Vérifier le pont
                      </Button>
                    </div>
                    {appsResult.state === 'failed' && (
                      <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {appsResult.message}
                      </p>
                    )}
                  </SetupStep>

                  <SetupStep
                    rank={3}
                    title="Choisissez la destination"
                    state={destinationStepState}
                  />
                </div>
              </SetupFlow>
            ),
          },
          {
            id: 'destination',
            title: 'Destination',
            content: (
              <div className="flex flex-col gap-4">
                <AsyncPanel
                  state={appsResult.state}
                  idle={
                    <p className="text-xs text-muted-foreground">
                      Vérifiez le pont à l’étape précédente pour lire vos applications.
                    </p>
                  }
                  skeleton={<Skeleton className="h-8.5 w-full" />}
                  failedTitle="La lecture des applications a échoué"
                  failedMessage={appsResult.state === 'failed' ? appsResult.message : undefined}
                  onRetry={() => void verifyToken()}
                >
                  <SelectField
                    id={APP_PICK_ID}
                    aria-label="Application"
                    label="Application"
                    value={target.appId ?? ''}
                    disabled={busy}
                    onValueChange={(id) => {
                      const app =
                        appsResult.state === 'ready'
                          ? appsResult.data.find((entry) => entry.id === id)
                          : undefined
                      if (app) void selectApp(app)
                    }}
                    items={
                      appsResult.state === 'ready'
                        ? appsResult.data.map((app) => ({
                            value: app.id,
                            label: `${app.name} — ${app.bundleId}`,
                          }))
                        : []
                    }
                  />
                </AsyncPanel>

                <AsyncPanel
                  state={versionsResult.state}
                  idle={
                    <p className="text-xs text-muted-foreground">
                      Choisissez d’abord une application.
                    </p>
                  }
                  skeleton={<Skeleton className="h-8.5 w-full" />}
                  failedTitle="La lecture des versions a échoué"
                  failedMessage={
                    versionsResult.state === 'failed' ? versionsResult.message : undefined
                  }
                  onRetry={() => selectedApp && void selectApp(selectedApp)}
                >
                  <SelectField
                    id={VERSION_PICK_ID}
                    aria-label="Version"
                    label="Version"
                    value={target.versionId ?? ''}
                    disabled={busy}
                    onValueChange={(id) => {
                      const version =
                        versionsResult.state === 'ready'
                          ? versionsResult.data.find((entry) => entry.id === id)
                          : undefined
                      if (version) void selectVersion(version)
                    }}
                    items={
                      versionsResult.state === 'ready'
                        ? versionsResult.data.map((version) => ({
                            value: version.id,
                            label: `${version.versionString} · ${version.state}`,
                          }))
                        : []
                    }
                  />
                  {pickedVersionLock && (
                    <p role="alert" className="text-xs text-warning">
                      {pickedVersionLock}
                    </p>
                  )}
                </AsyncPanel>

                <AsyncPanel
                  state={localizationsResult.state}
                  idle={
                    <p className="text-xs text-muted-foreground">Choisissez d’abord une version.</p>
                  }
                  skeleton={<Skeleton className="h-8.5 w-full" />}
                  failedTitle="La lecture des langues a échoué"
                  failedMessage={
                    localizationsResult.state === 'failed' ? localizationsResult.message : undefined
                  }
                  onRetry={() => selectedVersion && void selectVersion(selectedVersion)}
                >
                  {matchedLocalization ? (
                    <p className="text-xs text-foreground">
                      Langue App Store : {matchedLocalization.locale} — localisation{' '}
                      {matchedLocalization.id.slice(0, 4)}…
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <SelectField
                        id={LOCALIZATION_PICK_ID}
                        aria-label="Langue App Store"
                        label="Langue App Store"
                        value={target.versionLocalization}
                        disabled={busy}
                        onValueChange={(id) => {
                          const found =
                            localizationsResult.state === 'ready'
                              ? localizationsResult.data.find((entry) => entry.id === id)
                              : undefined
                          if (found) edit({ locale: found.locale, versionLocalization: found.id })
                        }}
                        items={
                          localizationsResult.state === 'ready'
                            ? localizationsResult.data.map((entry) => ({
                                value: entry.id,
                                label: entry.locale,
                              }))
                            : []
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        La langue doit déjà exister sur cette version dans App Store Connect.
                      </p>
                    </div>
                  )}
                </AsyncPanel>

                <details className="border-t pt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium marker:text-muted-foreground hover:text-foreground">
                    Saisir les identifiants à la main
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor={APP_FIELD_ID}>Identifiant de l’application</FieldLabel>
                      <Input
                        id={APP_FIELD_ID}
                        placeholder="com.exemple.monapp"
                        value={target.bundleId}
                        disabled={busy}
                        onChange={(event) =>
                          edit({
                            bundleId: event.target.value.trim(),
                            appId: undefined,
                            appName: undefined,
                          })
                        }
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor={VERSION_FIELD_ID}>Version</FieldLabel>
                      <Input
                        id={VERSION_FIELD_ID}
                        placeholder="1.4.0"
                        value={target.appVersion}
                        disabled={busy}
                        onChange={(event) =>
                          edit({ appVersion: event.target.value.trim(), versionId: undefined })
                        }
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
                        onChange={(event) =>
                          edit({ versionLocalization: event.target.value.trim() })
                        }
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Il se lit avec{' '}
                      <code className="text-foreground">{commandLine(LOCALIZATION_HINT)}</code>.
                    </p>
                  </div>
                </details>
              </div>
            ),
          },
          {
            id: 'envoi',
            title: 'Envoi',
            content: (
              <div className="flex flex-col gap-4">
                {releases.length > 1 && (
                  <SelectField
                    id={RELEASE_PICK_ID}
                    label="Version figée"
                    aria-label="Version figée"
                    value={release.id}
                    disabled={busy}
                    onValueChange={onPickRelease}
                    items={releases.map((entry) => ({ value: entry.id, label: entry.name }))}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Version figée : {release.name} · {release.files.length} planche
                  {release.files.length > 1 ? 's' : ''} · {ascSizeLabel(release)}
                  {release.watermarked ? ' · filigrane' : ''}
                </p>

                {localeMismatch && (
                  <p role="alert" className="text-xs text-warning">
                    Ce lot a été rendu en « {release.locale} » mais viserait la fiche «{' '}
                    {target.locale} ».
                  </p>
                )}

                {findings.length > 0 && (
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
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {finding.message}
                      </li>
                    ))}
                  </ul>
                )}

                {pickedVersionLock && (
                  <p role="alert" className="text-xs text-warning">
                    {pickedVersionLock}
                  </p>
                )}

                {findings.length === 0 && !pickedVersionLock && (
                  <p className="flex items-center gap-2 text-xs text-success">
                    <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                    Preflight sans réserve : {targetSummary(target, release)}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void prepare()}
                    loading={progress !== null}
                    disabled={refused || busy}
                  >
                    <Package aria-hidden />
                    Préparer le lot
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void download()}
                    loading={downloading}
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
                    <AlertTitle>Le lot a changé depuis qu’il a été figé</AlertTitle>
                    <AlertDescription>
                      {drifted} planche{drifted > 1 ? 's' : ''} ne correspond
                      {drifted > 1 ? 'ent' : ''} plus à la version figée. Figez un nouveau lot pour
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
                        navigator.clipboard
                          ?.writeText(commandLine(command))
                          .then(() => toast('Commande copiée.', 'success'))
                          .catch(() => toast('La copie a échoué.', 'error'))
                      }}
                    >
                      <Copy aria-hidden />
                      Copier
                    </Button>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t pt-4">
                  <Label className="flex items-center justify-between gap-3 text-xs font-normal text-foreground sm:text-xs">
                    Essai à blanc (rien n’est modifié chez Apple)
                    <Switch
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                      aria-label="Essai à blanc"
                      disabled={busy}
                    />
                  </Label>
                  {/* Le seul drapeau destructeur de la boîte : décoché par défaut, et
                      dit en toutes lettres ce qu'il supprime. */}
                  <Label className="flex items-center justify-between gap-3 text-xs font-normal text-foreground sm:text-xs">
                    Supprimer les captures déjà en ligne avant d’envoyer
                    <Switch
                      checked={replaceExisting}
                      onCheckedChange={setReplaceExisting}
                      aria-label="Remplacer les captures existantes"
                      disabled={busy}
                    />
                  </Label>

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
                            <Check className="size-3.5 shrink-0" aria-hidden />
                          ) : (
                            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
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
      <ConfirmAction
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publier chez Apple"
        description={confirmDescription}
        confirmLabel="Publier maintenant"
        destructive={replaceExisting}
        onConfirm={() => void publish()}
      />
    </>
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
